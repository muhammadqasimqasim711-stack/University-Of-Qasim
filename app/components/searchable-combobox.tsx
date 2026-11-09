"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type ComboboxOption = string | { label: string; value: string };

interface SearchableComboboxProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  disabled?: boolean;
  allOptionLabel?: string;
}

export function SearchableCombobox({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled = false,
  allOptionLabel,
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Normalize options to { label, value }
  const normalizedOptions = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { label: opt, value: opt } : opt,
    );
  }, [options]);

  // Filter options based on typed input
  const filteredOptions = useMemo(() => {
    if (!value.trim()) return normalizedOptions;
    const term = value.trim().toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term),
    );
  }, [normalizedOptions, value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function handleSelect(selectedValue: string) {
    onChange(selectedValue);
    setIsOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  const defaultAllLabel = allOptionLabel ?? `All ${label}s`;

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        position: "relative",
        minWidth: "160px",
      }}
    >
      <label
        htmlFor={id}
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: "var(--text)",
          margin: 0,
        }}
      >
        {label}
      </label>

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          width: "100%",
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder ?? `Search or select ${label.toLowerCase()}…`}
          autoComplete="off"
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
            } else if (e.key === "ArrowDown" && !isOpen) {
              setIsOpen(true);
            }
          }}
          style={{
            width: "100%",
            padding: "8px 46px 8px 10px",
            fontSize: "13px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            background: disabled ? "var(--bg-muted, #f1f5f9)" : "#ffffff",
            color: "var(--text)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Right side controls: Clear icon (if value present) + Dropdown Chevron */}
        <div
          style={{
            position: "absolute",
            right: "8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {value && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              title="Clear"
              aria-label="Clear input"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "14px",
                lineHeight: "1",
                color: "var(--muted)",
                borderRadius: "3px",
              }}
            >
              ×
            </button>
          ) : null}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setIsOpen((prev) => !prev);
                if (!isOpen && inputRef.current) {
                  inputRef.current.focus();
                }
              }
            }}
            title="Toggle dropdown"
            aria-label="Toggle dropdown"
            style={{
              background: "transparent",
              border: "none",
              cursor: disabled ? "default" : "pointer",
              padding: "2px",
              fontSize: "10px",
              lineHeight: "1",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isOpen ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "3px",
            maxHeight: "220px",
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            boxShadow: "0 6px 16px rgba(0, 0, 0, 0.12)",
            zIndex: 100,
          }}
        >
          {/* Default 'All' option */}
          <div
            onClick={() => handleSelect("")}
            style={{
              padding: "8px 12px",
              fontSize: "13px",
              cursor: "pointer",
              borderBottom: "1px solid #f1ede4",
              color: !value ? "var(--green)" : "var(--muted)",
              fontWeight: !value ? "600" : "normal",
              background: !value ? "#f8f5ee" : "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f4ece1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = !value ? "#f8f5ee" : "transparent";
            }}
          >
            {defaultAllLabel}
          </div>

          {filteredOptions.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                fontSize: "12px",
                color: "var(--muted)",
                fontStyle: "italic",
              }}
            >
              No matching options found
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected =
                value.trim().toLowerCase() === opt.value.toLowerCase() ||
                value.trim().toLowerCase() === opt.label.toLowerCase();
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: "8px 12px",
                    fontSize: "13px",
                    cursor: "pointer",
                    color: isSelected ? "var(--green)" : "var(--text)",
                    fontWeight: isSelected ? "600" : "normal",
                    background: isSelected ? "#f8f5ee" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f4ece1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected
                      ? "#f8f5ee"
                      : "transparent";
                  }}
                >
                  {opt.label}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
