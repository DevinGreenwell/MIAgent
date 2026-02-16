import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useStore } from "../../store";
import { getPdfUrl } from "../../api/client";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export default function PdfViewer() {
  const { selectedDocumentId, setPdfOpen } = useStore();
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);

  if (!selectedDocumentId) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <button
          onClick={() => setPdfOpen(false)}
          className="text-sm text-primary hover:underline"
        >
          ← Back to details
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 rounded hover:bg-accent disabled:opacity-30 text-foreground"
          >
            ‹
          </button>
          <span className="text-sm text-foreground">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
            className="px-2 py-1 rounded hover:bg-accent disabled:opacity-30 text-foreground"
          >
            ›
          </button>
          <span className="mx-2 text-border">|</span>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="px-2 py-1 rounded hover:bg-accent text-sm text-foreground"
          >
            −
          </button>
          <span className="text-sm text-foreground">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="px-2 py-1 rounded hover:bg-accent text-sm text-foreground"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-muted">
        <Document
          file={getPdfUrl(selectedDocumentId)}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="text-muted-foreground">Loading PDF...</div>}
        >
          <Page pageNumber={currentPage} scale={scale} />
        </Document>
      </div>
    </div>
  );
}
