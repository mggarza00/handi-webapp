/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import * as React from "react";

type OkResponse<T> = { ok: true; data: T };
type ErrResponse = { ok: false; error: unknown };

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export default function DevTestPage() {
  const [result, setResult] = React.useState<string>("—");

  async function ping() {
    try {
      const res = await fetch("/api/ping", {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      const json: unknown = await res.json();
      if (typeof json === "object" && json && "ok" in json) {
        const j = json as OkResponse<unknown> | ErrResponse;
        if ("ok" in j && j.ok === true) {
          setResult("OK");
        } else {
          const msg =
            "error" in j
              ? getErrorMessage((j as ErrResponse).error)
              : "Error desconocido";
          setResult(`ERR: ${msg}`);
        }
      } else {
        setResult("ERR: respuesta inválida");
      }
    } catch (e: unknown) {
      setResult(`ERR: ${getErrorMessage(e)}`);
    }
  }

  async function testRequests() {
    try {
      const res = await fetch("/api/requests", {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
      const json: unknown = await res.json();
      if (typeof json === "object" && json) {
        if (
          "ok" in json &&
          (json as any).ok === true &&
          "data" in (json as any)
        ) {
          setResult("LIST OK");
          return;
        }
        if ("error" in (json as any)) {
          setResult(`ERR: ${getErrorMessage((json as any).error)}`);
          return;
        }
      }
      setResult("ERR: respuesta inesperada");
    } catch (e: unknown) {
      setResult(`ERR: ${getErrorMessage(e)}`);
    }
  }

  async function testCreate() {
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ title: "Test", city: "Monterrey" }),
      });
      const json: unknown = await res.json();
      if (typeof json === "object" && json) {
        if (
          "ok" in json &&
          (json as any).ok === true &&
          "data" in (json as any)
        ) {
          setResult("CREATE OK");
          return;
        }
        if ("error" in (json as any)) {
          setResult(`ERR: ${getErrorMessage((json as any).error)}`);
          return;
        }
      }
      setResult("ERR: respuesta inesperada");
    } catch (e: unknown) {
      setResult(`ERR: ${getErrorMessage(e)}`);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Dev Test</h1>
      <div className="flex gap-2">
        <button onClick={ping} className="px-3 py-2 rounded bg-gray-200">
          Ping
        </button>
        <button
          onClick={testRequests}
          className="px-3 py-2 rounded bg-gray-200"
        >
          List Requests
        </button>
        <button onClick={testCreate} className="px-3 py-2 rounded bg-gray-200">
          Create Request
        </button>
      </div>
      <pre className="bg-gray-50 p-3 rounded">{result}</pre>
    </div>
  );
}
