"use client";

import { useRef, useState } from "react";

/**
 * Muestra el correo tal cual se mandó. En un iframe para que sus estilos
 * no choquen con los del sitio; sin allow-scripts (los correos no traen
 * scripts y así ninguno podría correr), pero con allow-same-origin para
 * que las fotos de respuestas (que piden sesión) carguen y para poder
 * medir su alto. Los enlaces abren en la ventana completa.
 */
export function EmailFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  const doc = html.includes("<head>") ? html.replace("<head>", '<head><base target="_top">') : `<base target="_top">${html}`;

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={doc}
      sandbox="allow-same-origin allow-popups allow-top-navigation-by-user-activation"
      className="w-full rounded-xl border-2 border-[var(--nb-line)] bg-[var(--sky-1)]"
      style={{ height }}
      onLoad={() => {
        const body = ref.current?.contentDocument?.body;
        if (body) setHeight(body.scrollHeight + 8);
      }}
    />
  );
}
