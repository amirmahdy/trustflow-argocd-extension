(() => {
  if (!window.extensionsAPI || !window.React) {
    console.error("TrustFlow extension: Argo CD extensions API or React missing.");
    return;
  }

  const React = window.React;
  const { useEffect, useMemo, useState, useRef } = React;

  const DEFAULT_BASE_URL = "/extensions/trustflow";
  const WORKLOAD_KINDS = new Set([
    "Deployment",
    "StatefulSet",
    "DaemonSet",
    "ReplicaSet",
    "Job",
    "CronJob",
    "Pod",
  ]);

  const styles = {
    root: {
      padding: "14px 18px",
      fontFamily: "var(--font-family, sans-serif)",
      background:
        "radial-gradient(1200px 420px at 8% 0%, rgba(59, 130, 246, 0.18), transparent 60%), radial-gradient(900px 420px at 100% 10%, rgba(16, 185, 129, 0.18), transparent 55%), #f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: "16px",
      boxShadow:
        "0 12px 30px rgba(15, 23, 42, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.6)",
      color: "#0f172a",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "12px 14px",
      borderRadius: "14px",
      border: "1px solid rgba(148, 163, 184, 0.45)",
      background: "rgba(255, 255, 255, 0.8)",
      boxShadow: "0 0 20px rgba(59, 130, 246, 0.18)",
      marginBottom: "16px",
    },
    title: { fontSize: "16px", fontWeight: 700, letterSpacing: "0.01em" },
    glowBadge: {
      padding: "4px 10px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      background: "linear-gradient(135deg, #60a5fa, #34d399)",
      color: "#0f172a",
      boxShadow: "0 0 16px rgba(59, 130, 246, 0.35)",
    },
    section: { marginBottom: "16px" },
    sectionCard: {
      padding: "14px",
      borderRadius: "14px",
      border: "1px solid #e2e8f0",
      background: "rgba(255, 255, 255, 0.88)",
      boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
    },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "10px",
      marginBottom: "12px",
    },
    sectionTitle: { fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em" },
    row: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
      lineHeight: "18px",
    },
    code: {
      fontFamily: "ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "12px",
      background: "rgba(15, 23, 42, 0.06)",
      border: "1px solid rgba(148, 163, 184, 0.45)",
      borderRadius: "8px",
      padding: "4px 8px",
    },
    caption: { fontSize: "12px", color: "#5f6b7c" },
    error: { fontSize: "12px", color: "#b42318", marginTop: "8px" },
    grid: { display: "grid", gap: "12px" },
    cardGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
      gap: "10px",
    },
    metricValue: { fontSize: "20px", fontWeight: 700 },
    metricLabel: { fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" },
    detailsCard: {
      marginTop: "12px",
      padding: "12px",
      borderRadius: "12px",
      border: "1px solid rgba(148, 163, 184, 0.4)",
      background: "rgba(248, 250, 252, 0.95)",
      boxShadow: "0 8px 16px rgba(15, 23, 42, 0.06)",
    },
    detailsHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "10px",
      marginBottom: "10px",
    },
    detailsList: { display: "grid", gap: "10px" },
    detailRow: {
      padding: "10px 12px",
      borderRadius: "10px",
      border: "1px solid rgba(148, 163, 184, 0.35)",
      background: "rgba(255, 255, 255, 0.9)",
    },
    detailTitle: { fontSize: "13px", fontWeight: 600 },
    detailMeta: { fontSize: "11px", color: "#64748b" },
    detailBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "999px",
      fontSize: "10px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      background: "rgba(148, 163, 184, 0.2)",
      color: "#334155",
    },
    link: {
      fontSize: "12px",
      color: "#2563eb",
      textDecoration: "none",
    },
    closeButton: {
      border: "1px solid rgba(148, 163, 184, 0.5)",
      background: "rgba(255, 255, 255, 0.9)",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: 600,
      color: "#334155",
      cursor: "pointer",
    },
    imageCard: {
      padding: "10px 12px",
      borderRadius: "12px",
      border: "1px solid rgba(148, 163, 184, 0.4)",
      background: "rgba(248, 250, 252, 0.9)",
      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
    },
  };

  const statusStyle = (state) => {
    if (state === "PASS")
      return {
        background: "#ecfdf3",
        color: "#157f3d",
        boxShadow: "0 0 12px rgba(34, 197, 94, 0.25)",
      };
    if (state === "FAIL")
      return {
        background: "#fff1f1",
        color: "#b42318",
        boxShadow: "0 0 12px rgba(248, 113, 113, 0.3)",
      };
    if (state === "PENDING")
      return {
        background: "#eef2ff",
        color: "#3730a3",
        boxShadow: "0 0 12px rgba(99, 102, 241, 0.25)",
      };
    return { background: "#f2f4f7", color: "#475467" };
  };

  const parseJSON = (input) => {
    if (!input || typeof input !== "string") return null;
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  };

  const dedupe = (list) => Array.from(new Set(list.filter(Boolean)));

  const truncateText = (value, limit = 200) => {
    if (!value || typeof value !== "string") return "";
    if (value.length <= limit) return value;
    return `${value.slice(0, limit).trim()}…`;
  };

  const buildVulnTargets = (resource, application) => {
    const targets = [];
    const live = parseJSON(resource?.liveState);
    if (resource?.kind === "Application") {
      const resources = application?.status?.resources || live?.status?.resources || [];
      resources.forEach((item) => {
        if (!WORKLOAD_KINDS.has(item.kind)) return;
        targets.push({
          kind: item.kind,
          name: item.name,
          namespace: item.namespace || application?.metadata?.namespace,
        });
      });
    } else if (resource?.kind) {
      targets.push({
        kind: resource.kind,
        name: resource.name || live?.metadata?.name,
        namespace: resource.namespace || live?.metadata?.namespace,
      });
    }
    return targets;
  };

  const formatTargetLabel = (target) => {
    if (!target) return "";
    const ns = target.namespace ? ` (${target.namespace})` : "";
    return `${target.kind}/${target.name}${ns}`;
  };

  const pickVulnLink = (item) => {
    if (!item || typeof item !== "object") return "";
    if (item.primaryLink) return item.primaryLink;
    if (Array.isArray(item.links) && item.links.length) return item.links[0];
    return "";
  };

  const extractImagesFromPodSpec = (spec) => {
    if (!spec) return [];
    const images = [];
    const collect = (containers) => {
      if (!Array.isArray(containers)) return;
      containers.forEach((container) => {
        if (container && typeof container.image === "string") images.push(container.image);
      });
    };
    collect(spec.initContainers);
    collect(spec.containers);
    collect(spec.ephemeralContainers);
    return images;
  };

  const extractImagesFromWorkload = (live) => {
    if (!live || typeof live !== "object") return [];
    const kind = live.kind;
    if (kind === "Pod") return extractImagesFromPodSpec(live.spec);
    if (kind === "CronJob") {
      return extractImagesFromPodSpec(live.spec?.jobTemplate?.spec?.template?.spec);
    }
    if (kind === "Job") {
      return extractImagesFromPodSpec(live.spec?.template?.spec);
    }
    if (live.spec?.template?.spec) {
      return extractImagesFromPodSpec(live.spec?.template?.spec);
    }
    return [];
  };

  const extractImagesFromApplication = (live) => {
    const images = live?.status?.summary?.images;
    if (Array.isArray(images)) return images;
    return [];
  };

  const extractImages = (resource, application) => {
    if (!resource) return extractImagesFromApplication(application);
    const live = parseJSON(resource.liveState);
    if (resource.kind === "Application") {
      const fromLive = extractImagesFromApplication(live);
      return fromLive.length ? fromLive : extractImagesFromApplication(application);
    }
    const fromWorkload = extractImagesFromWorkload(live);
    return fromWorkload.length ? fromWorkload : extractImagesFromApplication(application);
  };

	  const hasDigest = (image) => /@sha256:[a-f0-9]{64}$/i.test(image || "");

	  const buildHeaders = (application) => {
	    const appNamespace = application?.metadata?.namespace || "argocd";
	    const appName = application?.metadata?.name || "";
	    const projectName = application?.spec?.project || "default";
	    const headers = {
	      Accept: "application/json",
	      "Content-Type": "application/json",
	    };
	    if (appName) {
	      headers["Argocd-Application-Name"] = `${appNamespace}:${appName}`;
	      headers["Argocd-Project-Name"] = projectName;
	    }
	    return headers;
	  };

	  const looksLikeGzipBytes = (bytes) => {
	    if (!bytes || bytes.length < 2) return false;
	    return bytes[0] === 0x1f && bytes[1] === 0x8b;
	  };

	  const decodeUtf8 = (bytes) => {
	    if (!bytes || !bytes.length) return "";
	    try {
	      return new TextDecoder("utf-8").decode(bytes);
	    } catch (error) {
	      return "";
	    }
	  };

	  const decompressGzipToText = async (bytes) => {
	    if (!looksLikeGzipBytes(bytes)) return null;
	    if (typeof DecompressionStream === "undefined") return null;
	    try {
	      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
	      const decompressed = await new Response(stream).arrayBuffer();
	      return decodeUtf8(new Uint8Array(decompressed));
	    } catch (error) {
	      return null;
	    }
	  };

	  const safeParseJSON = (text) => {
	    if (!text) return null;
	    try {
	      return JSON.parse(text);
    } catch (error) {
      return null;
	    }
	  };

	  const summarizeTextForError = (text, limit = 400) => {
	    if (!text || typeof text !== "string") return "";
	    const cleaned = text.replace(/[\r\n\t]+/g, " ").trim();
	    if (cleaned.length <= limit) return cleaned;
	    return `${cleaned.slice(0, limit).trim()}…`;
	  };

	  const looksLikeBinaryText = (text) => {
	    if (!text || typeof text !== "string") return false;
	    const sample = text.slice(0, 200);
	    if (!sample) return false;
	    let bad = 0;
	    for (let i = 0; i < sample.length; i += 1) {
	      const code = sample.charCodeAt(i);
	      if (sample[i] === "\uFFFD") bad += 1;
	      else if (code < 9) bad += 1;
	      else if (code > 13 && code < 32) bad += 1;
	    }
	    return bad / sample.length > 0.05;
	  };

	  const fetchJSON = async (url, headers) => {
	    const response = await fetch(url, {
	      method: "GET",
	      headers,
	      credentials: "include",
	    });
	    const buffer = await response.arrayBuffer();
	    const bytes = new Uint8Array(buffer || []);
	    const text =
	      (await decompressGzipToText(bytes)) ??
	      decodeUtf8(bytes);
	    const data = safeParseJSON(text);
	    if (!response.ok) {
	      if (data && typeof data.error === "string") {
	        throw new Error(data.error);
	      }
	      if (data && Array.isArray(data.errors) && data.errors.length) {
	        throw new Error(data.errors.join(" | "));
	      }
	      if (looksLikeGzipBytes(bytes)) {
	        throw new Error(
	          "Backend returned gzipped bytes. A proxy may be stripping Content-Encoding: gzip; check Argo CD extension proxy config or baseUrl.",
	        );
	      }
	      if (looksLikeBinaryText(text)) {
	        throw new Error(
	          `Request failed: ${response.status}. Backend returned non-JSON binary data; check Argo CD extension proxy config or baseUrl.`,
	        );
	      }
	      const snippet = summarizeTextForError(text);
	      throw new Error(snippet || `Request failed: ${response.status}`);
	    }
	    if (data) return data;
	    if (looksLikeGzipBytes(bytes)) {
	      throw new Error(
	        "Backend returned gzipped bytes. A proxy may be stripping Content-Encoding: gzip; check Argo CD extension proxy config or baseUrl.",
	      );
	    }
	    if (looksLikeBinaryText(text)) {
	      throw new Error(
	        `Expected JSON response, got binary data (HTTP ${response.status}). Check Argo CD extension proxy config or baseUrl.`,
	      );
	    }
	    const snippet = summarizeTextForError(text);
	    throw new Error(snippet ? `Expected JSON response. Body: ${snippet}` : "Expected JSON response.");
	  };

  const TrustFlowPanel = (props) => {
    const baseUrl = window.TRUSTFLOW_VARS?.baseUrl || DEFAULT_BASE_URL;
    const vulnScannerName = window.TRUSTFLOW_VARS?.vulnScannerName || "Trivy";
    const headers = useMemo(() => buildHeaders(props.application), [props.application]);
    const resource = props.resource;
    const vulnTargets = useMemo(
      () => buildVulnTargets(resource, props.application),
      [resource, props.application],
    );

    const images = useMemo(() => {
      const raw = extractImages(resource, props.application);
      return dedupe(raw);
    }, [resource, props.application]);

    const [imageResults, setImageResults] = useState({});
    const [vulnSummary, setVulnSummary] = useState({
      loading: true,
      pass: false,
      reportCount: 0,
      summary: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
      error: "",
    });
    const [vulnDetails, setVulnDetails] = useState({
      open: false,
      loading: false,
      severity: "",
      items: [],
      error: "",
    });
    const detailRequestRef = useRef(0);

    useEffect(() => {
      let cancelled = false;
      const next = {};
      images.forEach((image) => {
        next[image] = {
          loading: true,
          signed: false,
          sbom: false,
          errors: [],
        };
      });
      setImageResults(next);

      const run = async (image) => {
        if (!hasDigest(image)) {
          return {
            loading: false,
            signed: false,
            sbom: false,
            errors: ["Image is not pinned by digest."],
          };
        }
        try {
          const data = await fetchJSON(
            `${baseUrl}/verify?image=${encodeURIComponent(image)}`,
            headers,
          );
          return {
            loading: false,
            signed: !!data.signed,
            sbom: !!data.sbom,
            errors: Array.isArray(data.errors) ? data.errors : [],
          };
        } catch (error) {
          return {
            loading: false,
            signed: false,
            sbom: false,
            errors: [error.message || "Verification failed."],
          };
        }
      };

      Promise.all(images.map((image) => run(image))).then((results) => {
        if (cancelled) return;
        const updated = {};
        images.forEach((image, index) => {
          updated[image] = results[index];
        });
        setImageResults(updated);
      });

      return () => {
        cancelled = true;
      };
    }, [images, baseUrl, headers]);

    useEffect(() => {
      let cancelled = false;
      const targets = vulnTargets;

      if (!targets.length) {
        setVulnSummary({
          loading: false,
          pass: false,
          reportCount: 0,
          summary: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
          error: "No workload targets found.",
        });
        return () => {
          cancelled = true;
        };
      }

      setVulnSummary((prev) => ({ ...prev, loading: true, error: "" }));

      const run = async () => {
        const aggregate = {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          unknown: 0,
        };
        let reportCount = 0;
        const errors = [];

        const results = await Promise.all(
          targets.map((target) =>
            fetchJSON(
              `${baseUrl}/vulns?namespace=${encodeURIComponent(
                target.namespace || "",
              )}&kind=${encodeURIComponent(target.kind)}&name=${encodeURIComponent(target.name)}`,
              headers,
            ).catch((error) => ({ error: error.message || "Vuln fetch failed." })),
          ),
        );

        results.forEach((result) => {
          if (result.error) {
            errors.push(result.error);
            return;
          }
          const summary = result.summary || {};
          aggregate.critical += Number(summary.critical || 0);
          aggregate.high += Number(summary.high || 0);
          aggregate.medium += Number(summary.medium || 0);
          aggregate.low += Number(summary.low || 0);
          aggregate.unknown += Number(summary.unknown || 0);
          reportCount += Number(result.reportCount || 0);
        });

        const pass =
          reportCount > 0 &&
          aggregate.critical === 0 &&
          aggregate.high === 0 &&
          aggregate.medium === 0 &&
          aggregate.low === 0 &&
          aggregate.unknown === 0;

        return { aggregate, reportCount, pass, errors };
      };

      run()
        .then((result) => {
          if (cancelled) return;
          setVulnSummary({
            loading: false,
            pass: result.pass,
            reportCount: result.reportCount,
            summary: result.aggregate,
            error: result.errors.join(" | "),
          });
        })
        .catch((error) => {
          if (cancelled) return;
          setVulnSummary({
            loading: false,
            pass: false,
            reportCount: 0,
            summary: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
            error: error.message || "Failed to fetch vulnerability data.",
          });
        });

      return () => {
        cancelled = true;
      };
    }, [vulnTargets, baseUrl, headers]);

    useEffect(() => {
      setVulnDetails({
        open: false,
        loading: false,
        severity: "",
        items: [],
        error: "",
      });
    }, [vulnTargets]);

    const renderStatus = (label, state) =>
      React.createElement(
        "span",
        { style: { ...styles.pill, ...statusStyle(state) } },
        `${label}: ${state}`,
      );

    const trivyState = vulnSummary.loading ? "PENDING" : vulnSummary.pass ? "PASS" : "FAIL";
    const severityItems = [
      { key: "critical", label: "Critical", value: vulnSummary.summary.critical, tone: "#b42318" },
      { key: "high", label: "High", value: vulnSummary.summary.high, tone: "#d97706" },
      { key: "medium", label: "Medium", value: vulnSummary.summary.medium, tone: "#f59e0b" },
      { key: "low", label: "Low", value: vulnSummary.summary.low, tone: "#16a34a" },
      { key: "unknown", label: "Unknown", value: vulnSummary.summary.unknown, tone: "#64748b" },
    ];

    const handleSeverityClick = (item) => {
      if (vulnDetails.open && vulnDetails.severity === item.label) {
        setVulnDetails({
          open: false,
          loading: false,
          severity: "",
          items: [],
          error: "",
        });
        return;
      }

      if (!vulnTargets.length) {
        setVulnDetails({
          open: true,
          loading: false,
          severity: item.label,
          items: [],
          error: "No workload targets found.",
        });
        return;
      }

      const requestId = detailRequestRef.current + 1;
      detailRequestRef.current = requestId;
      setVulnDetails({
        open: true,
        loading: true,
        severity: item.label,
        items: [],
        error: "",
      });

      const severityParam = item.key.toUpperCase();
      Promise.all(
        vulnTargets.map((target) =>
          fetchJSON(
            `${baseUrl}/vulns/details?namespace=${encodeURIComponent(
              target.namespace || "",
            )}&kind=${encodeURIComponent(target.kind)}&name=${encodeURIComponent(
              target.name,
            )}&severity=${encodeURIComponent(severityParam)}`,
            headers,
          )
            .then((data) => ({ data, target }))
            .catch((error) => ({
              error: error.message || "Vuln detail fetch failed.",
              target,
            })),
        ),
      ).then((results) => {
        if (detailRequestRef.current !== requestId) return;
        const items = [];
        const errors = [];
        results.forEach((result) => {
          if (result.error) {
            errors.push(result.error);
            return;
          }
          const list = Array.isArray(result.data?.items) ? result.data.items : [];
          list.forEach((entry) => {
            items.push({
              ...entry,
              target: result.target,
            });
          });
        });
        setVulnDetails({
          open: true,
          loading: false,
          severity: item.label,
          items,
          error: errors.join(" | "),
        });
      });
    };

    const renderVulnDetails = () => {
      if (!vulnDetails.open) return null;
      const title = `${vulnScannerName} ${vulnDetails.severity} vulnerabilities`;
      if (vulnDetails.loading) {
        return React.createElement(
          "div",
          { style: styles.detailsCard },
          React.createElement(
            "div",
            { style: styles.detailsHeader },
            React.createElement("div", { style: styles.sectionTitle }, title),
            React.createElement(
              "button",
              {
                style: styles.closeButton,
                onClick: () =>
                  setVulnDetails({
                    open: false,
                    loading: false,
                    severity: "",
                    items: [],
                    error: "",
                  }),
              },
              "Close",
            ),
          ),
          React.createElement("div", { style: styles.caption }, "Loading vulnerabilities..."),
        );
      }

      if (vulnDetails.error) {
        return React.createElement(
          "div",
          { style: styles.detailsCard },
          React.createElement(
            "div",
            { style: styles.detailsHeader },
            React.createElement("div", { style: styles.sectionTitle }, title),
            React.createElement(
              "button",
              {
                style: styles.closeButton,
                onClick: () =>
                  setVulnDetails({
                    open: false,
                    loading: false,
                    severity: "",
                    items: [],
                    error: "",
                  }),
              },
              "Close",
            ),
          ),
          React.createElement("div", { style: styles.error }, vulnDetails.error),
        );
      }

      if (!vulnDetails.items.length) {
        return React.createElement(
          "div",
          { style: styles.detailsCard },
          React.createElement(
            "div",
            { style: styles.detailsHeader },
            React.createElement("div", { style: styles.sectionTitle }, title),
            React.createElement(
              "button",
              {
                style: styles.closeButton,
                onClick: () =>
                  setVulnDetails({
                    open: false,
                    loading: false,
                    severity: "",
                    items: [],
                    error: "",
                  }),
              },
              "Close",
            ),
          ),
          React.createElement("div", { style: styles.caption }, "No vulnerabilities found."),
        );
      }

      return React.createElement(
        "div",
        { style: styles.detailsCard },
        React.createElement(
          "div",
          { style: styles.detailsHeader },
          React.createElement("div", { style: styles.sectionTitle }, title),
          React.createElement(
            "button",
            {
              style: styles.closeButton,
              onClick: () =>
                setVulnDetails({
                  open: false,
                  loading: false,
                  severity: "",
                  items: [],
                  error: "",
                }),
            },
            "Close",
          ),
        ),
        React.createElement(
          "div",
          { style: styles.detailsList },
          vulnDetails.items.map((item, index) => {
            const link = pickVulnLink(item);
            const titleText = item.id || item.title || "Vulnerability";
            const pkgText = [item.package, item.installedVersion]
              .filter(Boolean)
              .join(" ");
            const fixedText = item.fixedVersion ? `Fixed: ${item.fixedVersion}` : "";
            const artifactText = item.artifact ? `Artifact: ${item.artifact}` : "";
            const targetText = item.target ? formatTargetLabel(item.target) : "";
            return React.createElement(
              "div",
              { key: `${titleText}-${index}`, style: styles.detailRow },
              React.createElement(
                "div",
                { style: styles.row },
                React.createElement("div", { style: styles.detailBadge }, item.severity || "UNKNOWN"),
                targetText
                  ? React.createElement("div", { style: styles.detailMeta }, targetText)
                  : null,
                artifactText
                  ? React.createElement("div", { style: styles.detailMeta }, artifactText)
                  : null,
              ),
              React.createElement("div", { style: styles.detailTitle }, titleText),
              pkgText
                ? React.createElement("div", { style: styles.detailMeta }, pkgText)
                : null,
              fixedText
                ? React.createElement("div", { style: styles.detailMeta }, fixedText)
                : null,
              item.description
                ? React.createElement(
                  "div",
                  { style: styles.caption },
                  truncateText(item.description, 240),
                )
                : null,
              link
                ? React.createElement(
                  "a",
                  { href: link, target: "_blank", rel: "noreferrer", style: styles.link },
                  "Advisory",
                )
                : null,
            );
          }),
        ),
      );
    };

    return React.createElement(
      "div",
      { style: styles.root },
      React.createElement(
        "div",
        { style: styles.header },
        React.createElement(
          "div",
          null,
          React.createElement("div", { style: styles.title }, "TrustFlow"),
          React.createElement(
            "div",
            { style: styles.caption },
            "Supply-chain + runtime signals, unified.",
          ),
        )
      ),
      React.createElement(
        "div",
        { style: styles.section },
        React.createElement(
          "div",
          { style: styles.sectionCard },
          React.createElement(
            "div",
            { style: styles.sectionHeader },
            React.createElement("div", { style: styles.sectionTitle }, vulnScannerName),
            renderStatus("Overall", trivyState),
            React.createElement(
              "span",
              { style: styles.caption },
              `reports: ${vulnSummary.reportCount}`,
            ),
          ),
          vulnSummary.loading
            ? React.createElement("div", { style: styles.caption }, "Pending: scanning in progress.")
            : null,
          React.createElement(
            "div",
            { style: styles.cardGrid },
            severityItems.map((item) =>
              React.createElement(
                "div",
                {
                  key: item.key,
                  style: {
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: `1px solid ${item.tone}`,
                    boxShadow: `0 10px 22px rgba(15, 23, 42, 0.08), 0 0 14px ${item.tone}33`,
                    background: "rgba(255, 255, 255, 0.95)",
                    cursor: "pointer",
                  },
                  role: "button",
                  tabIndex: 0,
                  title: `View ${item.label} details`,
                  onClick: () => handleSeverityClick(item),
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleSeverityClick(item);
                    }
                  },
                },
                React.createElement("div", { style: styles.metricValue }, item.value),
                React.createElement(
                  "div",
                  { style: { ...styles.metricLabel, color: item.tone } },
                  item.label,
                ),
              ),
            ),
          ),
          renderVulnDetails(),
          vulnSummary.error
            ? React.createElement("div", { style: styles.error }, vulnSummary.error)
            : null,
        ),
      ),
      React.createElement(
        "div",
        { style: styles.section },
        React.createElement(
          "div",
          { style: styles.sectionCard },
          React.createElement("div", { style: styles.sectionTitle }, "SBOM + Signatures"),
          React.createElement("div", { style: styles.caption }, "Images"),
          React.createElement(
            "div",
            { style: styles.grid },
            images.length
              ? images.map((image) => {
                const result = imageResults[image] || {};
                const signedState = result.loading ? "PENDING" : result.signed ? "PASS" : "FAIL";
                const sbomState = result.loading ? "PENDING" : result.sbom ? "PASS" : "FAIL";
                return React.createElement(
                  "div",
                  { key: image, style: styles.imageCard },
                  React.createElement(
                    "div",
                    { style: styles.row },
                    React.createElement("span", { style: styles.code }, image),
                    React.createElement(
                      "a",
                      {
                        href: `${baseUrl}/verify?image=${encodeURIComponent(image)}`,
                        target: "_blank",
                        rel: "noreferrer",
                        style: styles.caption,
                      },
                      "provenance",
                    ),
                    React.createElement(
                      "span",
                      { style: styles.caption },
                      hasDigest(image) ? "digest pinned" : "digest missing",
                    ),
                  ),
                  React.createElement("div", { style: styles.row }, [
                    renderStatus("Signed", signedState),
                    renderStatus("SBOM", sbomState),
                  ]),
                  result.errors && result.errors.length
                    ? React.createElement("div", { style: styles.error }, result.errors.join(" | "))
                    : null,
                );
              })
              : React.createElement("div", { style: styles.caption }, "No images detected."),
          ),
        ),
      ),
    );
  };

  window.extensionsAPI.registerResourceExtension(
    TrustFlowPanel,
    "apps",
    "Deployment",
    "TrustFlow",
  );
  window.extensionsAPI.registerResourceExtension(
    TrustFlowPanel,
    "argoproj.io",
    "Application",
    "TrustFlow",
  );
})();
