"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function BookBarcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) {
      return;
    }

    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: true,
      margin: 12,
      height: 72,
      fontSize: 16,
    });
  }, [value]);

  return (
    <div className="barcode-panel">
      <svg ref={ref} role="img" aria-label={`Barcode ${value}`} />
    </div>
  );
}
