(() => {
  if (!window.extensionsAPI || !window.React) {
    console.error("TrustFlow extension: Argo CD extensions API or React missing.");
    return;
  }

  const React = window.React;
  const { useEffect, useMemo, useState } = React;

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
    root: { padding: "12px 16px", fontFamily: "var(--font-family, sans-serif)" },
    section: { marginBottom: "16px" },
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
      background: "#f4f5f7",
      borderRadius: "6px",
      padding: "2px 6px",
    },
    caption: { fontSize: "12px", color: "#5f6b7c" },
    error: { fontSize: "12px", color: "#b42318" },
    grid: { display: "grid", gap: "12px" },
  };

  const statusStyle = (state) => {
    if (state === "PASS") return { background: "#e7f6ed", color: "#157f3d" };
    if (state === "FAIL") return { background: "#fdecec", color: "#b42318" };
    if (state === "PENDING") return { background: "#eef2ff", color: "#3730a3" };
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

  const extractImages = (resource) => {
    if (!resource) return [];
    const live = parseJSON(resource.liveState);
    if (resource.kind === "Application") return extractImagesFromApplication(live);
    return extractImagesFromWorkload(live);
  };

  const hasDigest = (image) => /@sha256:[a-f0-9]{64}$/i.test(image || "");

  const buildHeaders = (application) => {
    const appNamespace = application?.metadata?.namespace || "argocd";
    const appName = application?.metadata?.name || "";
    const projectName = application?.spec?.project || "default";
    const headers = {
      "Content-Type": "application/json",
    };
    if (appName) {
      headers["Argocd-Application-Name"] = `${appNamespace}:${appName}`;
      headers["Argocd-Project-Name"] = projectName;
    }
    return headers;
  };

  const fetchJSON = async (url, headers) => {
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return response.json();
  };

  const TrustFlowPanel = (props) => {
    const baseUrl = window.TRUSTFLOW_VARS?.baseUrl || DEFAULT_BASE_URL;
    const headers = useMemo(() => buildHeaders(props.application), [props.application]);
    const resource = props.resource;

    const images = useMemo(() => {
      const raw = extractImages(resource);
      return dedupe(raw);
    }, [resource]);

    const [imageResults, setImageResults] = useState({});
    const [vulnSummary, setVulnSummary] = useState({
      loading: true,
      pass: false,
      reportCount: 0,
      summary: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
      error: "",
    });

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
      const targets = [];
      const live = parseJSON(resource?.liveState);

      if (resource?.kind === "Application") {
        const resources = props.application?.status?.resources || live?.status?.resources || [];
        resources.forEach((item) => {
          if (!WORKLOAD_KINDS.has(item.kind)) return;
          targets.push({
            kind: item.kind,
            name: item.name,
            namespace: item.namespace || props.application?.metadata?.namespace,
          });
        });
      } else if (resource?.kind) {
        targets.push({
          kind: resource.kind,
          name: resource.name || live?.metadata?.name,
          namespace: resource.namespace || live?.metadata?.namespace,
        });
      }

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
    }, [resource, props.application, baseUrl, headers]);

    const renderStatus = (label, state) =>
      React.createElement(
        "span",
        { style: { ...styles.pill, ...statusStyle(state) } },
        `${label}: ${state}`,
      );

    return React.createElement(
      "div",
      { style: styles.root },
      React.createElement(
        "div",
        { style: styles.section },
        React.createElement("div", { style: styles.row }, [
          renderStatus("Vulns", vulnSummary.loading ? "PENDING" : vulnSummary.pass ? "PASS" : "FAIL"),
          React.createElement(
            "span",
            { style: styles.caption },
            `reports: ${vulnSummary.reportCount}`,
          ),
          React.createElement(
            "span",
            { style: styles.caption },
            `C:${vulnSummary.summary.critical} H:${vulnSummary.summary.high} M:${vulnSummary.summary.medium} L:${vulnSummary.summary.low} U:${vulnSummary.summary.unknown}`,
          ),
        ]),
        vulnSummary.error
          ? React.createElement("div", { style: styles.error }, vulnSummary.error)
          : null,
      ),
      React.createElement(
        "div",
        { style: styles.section },
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
                  { key: image, style: { padding: "8px 0", borderBottom: "1px solid #eef2f7" } },
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
