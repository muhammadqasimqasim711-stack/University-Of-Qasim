"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function BookScan() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const openBookRef = useRef<(value: string) => Promise<void>>(async () => undefined);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    if (!cameraOn || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    let stopped = false;
    let controls: { stop: () => void } | undefined;

    void (async () => {
      try {
        const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser");
        if (stopped) return;

        const reader = new BrowserMultiFormatReader();
        reader.possibleFormats = [BarcodeFormat.CODE_128];

        reader
          .decodeFromVideoDevice(undefined, video, (result, _scanError, nextControls) => {
            controls = nextControls;
            if (stopped || !result) {
              return;
            }
            stopped = true;
            nextControls.stop();
            setCameraOn(false);
            void openBookRef.current(result.getText());
          })
          .then((nextControls) => {
            controls = nextControls;
            if (stopped) {
              nextControls.stop();
            }
          })
          .catch(() => {
            if (!stopped) {
              setError("Allow the camera to scan a barcode.");
              setCameraOn(false);
            }
          });
      } catch {
        if (!stopped) {
          setError("Failed to initialize camera scanner.");
          setCameraOn(false);
        }
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [cameraOn]);

  async function openBook(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a barcode.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(
        `/api/books/scan?code=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
      );
      if (response.status === 404) {
        setError("No book matches that barcode.");
        return;
      }
      if (!response.ok) {
        throw new Error("Could not look up the barcode.");
      }

      const book = (await response.json()) as { id: number };
      router.push(`/books/${book.id}`);
    } catch {
      setError("Could not look up the barcode.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    openBookRef.current = openBook;
  });

  function onScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void openBook(code);
  }

  return (
    <div className="scan-block">
      <form className="search-form" onSubmit={onScan}>
        <label className="field search-field" htmlFor="book-scan">
          <span>Scan barcode</span>
          <input
            id="book-scan"
            value={code}
            placeholder="Scan or type a barcode, then press Enter"
            autoComplete="off"
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button type="submit" disabled={pending}>
          Open book
        </button>
        <button
          type="button"
          className="button-quiet"
          onClick={() => {
            setError("");
            setCameraOn((current) => !current);
          }}
        >
          {cameraOn ? "Stop camera" : "Use camera"}
        </button>
      </form>
      {error ? (
        <p className="banner error" role="alert">
          {error}
        </p>
      ) : null}
      {cameraOn ? (
        <video ref={videoRef} className="scan-camera" muted playsInline />
      ) : null}
    </div>
  );
}
