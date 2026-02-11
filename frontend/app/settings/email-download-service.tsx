"use client";

import Button from "@/components/Button/Button";
import { useState } from "react";

type EmailObject = { email: string };
type EmailApiResponse =
	| string[]
	| EmailObject[]
	| { emails: string[] | EmailObject[] }
	| Record<string, unknown>;

export default function EmailListDownloadButton({ allowed }: { allowed: boolean }) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!allowed) return null;

	function extractEmails(payload: EmailApiResponse): string[] {
		// Case 1: backend returns ['a@x.com', 'b@y.com']
		if (Array.isArray(payload) && payload.every((x) => typeof x === "string")) {
			return payload as string[];
		}

		// Case 2: backend returns [{ email: 'a@x.com' }, ...]
		if (
			Array.isArray(payload) &&
			payload.every((x) => typeof x === "object" && x !== null && "email" in x)
		) {
			const arr = payload as EmailObject[];
			return arr.map((x) => x.email);
		}

		// Case 3: backend wraps data, e.g. { emails: [...] }
		if (
			typeof payload === "object" &&
			payload !== null &&
			Array.isArray((payload as Record<string, unknown>).emails)
		) {
			return extractEmails(((payload as Record<string, unknown>).emails) as EmailApiResponse);
		}

		// Fallback: nothing usable
		return [];
	}

	async function handleDownload() {
		setError(null);
		setLoading(true);
		try {
			const res = await fetch("/api/emails", {
				method: "GET",
			});
			if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
			const payload = await res.json();

			const emails = extractEmails(payload);

			if (emails.length === 0) {
				setError("Engin netföng fundust :(");
				return;
			}

			const content = emails.join("\n");
			const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "emaillist.txt";
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div>
			<Button onClick={handleDownload} disabled={loading} aria-label="Download emaillist">
				{loading ? "Sæki..." : "Sækja póstlista (.txt)"}
			</Button>
			{error && <p style={{ color: "red" }}>{error}</p>}
		</div>
	);
}
