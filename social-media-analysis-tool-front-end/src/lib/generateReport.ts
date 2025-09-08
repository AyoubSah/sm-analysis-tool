import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import React from "react";
import ReactDOM from "react-dom/client";
import ReportDocument from "@/components/report/ReportDocument";
import { useExportsStore } from "@/store/useExportsStore";

// Helper to wait a frame or specific ms
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function generateReport(): Promise<void> {
  // Create offscreen container
  const container = document.createElement("div");
  container.id = "pdf-render-root";
  container.classList.add("pdf-capture");
  Object.assign(container.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "900px", // A4 width at ~96dpi
    background: "#fff",
    color: "#0f172a",
    zIndex: "-1",
  } as CSSStyleDeclaration);
  document.body.appendChild(container);

  // Override CSS variables to hex values (avoid oklch which html2canvas can't parse)
  const PDF_SAFE_VARS: Record<string, string> = {
    "--background": "#ffffff",
    "--foreground": "#0f172a",
    "--card": "#ffffff",
    "--card-foreground": "#0f172a",
    "--popover": "#ffffff",
    "--popover-foreground": "#0f172a",
    "--primary": "#3b82f6",
    "--primary-foreground": "#ffffff",
    "--secondary": "#f3f4f6",
    "--secondary-foreground": "#1f2937",
    "--muted": "#f3f4f6",
    "--muted-foreground": "#6b7280",
    "--accent": "#f3f4f6",
    "--accent-foreground": "#1f2937",
    "--destructive": "#ef4444",
    "--border": "#e5e7eb",
    "--input": "#e5e7eb",
    "--ring": "#3b82f6",
    "--chart-1": "#3b82f6",
    "--chart-2": "#10b981",
    "--chart-3": "#f59e0b",
    "--chart-4": "#ef4444",
    "--chart-5": "#8b5cf6",
    "--sidebar": "#f8fafc",
    "--sidebar-foreground": "#0f172a",
    "--sidebar-primary": "#3b82f6",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": "#f3f4f6",
    "--sidebar-accent-foreground": "#1f2937",
    "--sidebar-border": "#e5e7eb",
    "--sidebar-ring": "#3b82f6",
  };
  Object.entries(PDF_SAFE_VARS).forEach(([k, v]) =>
    container.style.setProperty(k, v)
  );

  // Render the report React tree
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(ReportDocument));

  // Wait for charts/async paints to finish
  await sleep(300); // initial mount
  // Wait a bit more to ensure charts (with animations disabled) have painted
  await sleep(500);

  try {
    // Identify each page section by className we set in ReportDocument
    const pages = Array.from(
      container.querySelectorAll<HTMLDivElement>(".report-page")
    );
    if (!pages.length) throw new Error("No report pages mounted");

    // Prepare PDF (A4 portrait)
    const pdf = new jsPDF({
      unit: "pt",
      format: "a4",
      orientation: "portrait",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      const node = pages[i];

      // Render DOM to canvas
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        useCORS: true,
        scale: 2, // higher quality
        logging: false,
        onclone: (doc) => {
          // Ensure offscreen cloned root is visible for measurement
          const root = doc.getElementById("pdf-render-root");
          if (root) {
            root.style.left = "0"; // some libs measure better when on-screen
            // Re-apply safe variables inside cloned DOM in case cascade differs
            Object.entries(PDF_SAFE_VARS).forEach(([k, v]) =>
              (root as HTMLElement).style.setProperty(k, v)
            );
          }
        },
      });

      // Always fit to full page width and center; slice vertically if taller than one page
      const zoom = 0.92; // slight zoom-out so layouts breathe and reduce spillover
      const renderWidthPt = pageWidth * zoom;
      const x = (pageWidth - renderWidthPt) / 2;
      const scale = renderWidthPt / canvas.width; // px -> pt
      const totalHeightPt = canvas.height * scale;

      if (i > 0) pdf.addPage();

      if (totalHeightPt <= pageHeight) {
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(
          imgData,
          "PNG",
          x,
          0,
          renderWidthPt,
          totalHeightPt,
          undefined,
          "FAST"
        );
      } else {
        // Slice the tall canvas into page-sized chunks
        const sliceHeightPx = Math.floor(pageHeight / scale);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        const ctx = sliceCanvas.getContext("2d");
        let sy = 0;
        let first = true;
        while (sy < canvas.height) {
          const sh = Math.min(sliceHeightPx, canvas.height - sy);
          sliceCanvas.height = sh;
          ctx?.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx?.drawImage(
            canvas,
            0,
            sy,
            canvas.width,
            sh,
            0,
            0,
            canvas.width,
            sh
          );
          const imgData = sliceCanvas.toDataURL("image/png");
          const sliceHeightPt = sh * scale;
          if (!first) pdf.addPage();
          pdf.addImage(
            imgData,
            "PNG",
            x,
            0,
            renderWidthPt,
            sliceHeightPt,
            undefined,
            "FAST"
          );
          sy += sh;
          first = false;
        }
      }
    }

    // Name with timestamp
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `analysis-report-${ts}.pdf`;

    // Persist to store as data URL for later download
    const dataUrl = pdf.output("datauristring");
    useExportsStore.getState().addExport({
      id: crypto.randomUUID(),
      type: "pdf",
      name: "PDF Report",
      filename,
      mime: "application/pdf",
      size: dataUrl.length,
      createdAt: new Date().toISOString(),
      dataUrl,
    });

    // Trigger immediate download too
    pdf.save(filename);
  } finally {
    // Cleanup
    try {
      root.unmount();
    } catch {
      // ignore
    }
    container.remove();
  }
}
