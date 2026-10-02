"use client";

import { useEffect } from "react";

// Solo se usa si el layout raíz (root layout) en sí truena. Se mantiene
// independiente de globals.css / fuentes / el resto del árbol, para que
// siga funcionando aunque esa sea justo la parte rota.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fdeef5",
          fontFamily: "Trebuchet MS, sans-serif",
          color: "#3a2b33",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: "90%",
            background: "#fff",
            border: "2px solid #f0b6d3",
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
          }}
        >
          <p style={{ fontSize: 40, margin: "0 0 12px" }}>💾💥</p>
          <p style={{ fontWeight: 700, fontSize: 18, margin: "0 0 6px" }}>El sistema se cayó</p>
          <p style={{ fontSize: 14, color: "#7a6670", margin: "0 0 18px" }}>
            Ocurrió un error grave al cargar la página. Intenta de nuevo en un momento.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: "none",
              borderRadius: 18,
              padding: "10px 22px",
              fontWeight: 700,
              fontSize: 14,
              color: "#fff",
              background: "#ff5fa8",
              cursor: "pointer",
            }}
          >
            🔄 Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
