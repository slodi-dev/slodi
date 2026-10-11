# TODO: Unsubscribe — Frontend Changes

The backend is fully implemented. These are the remaining frontend tasks.

---

## New backend endpoint

```
GET /emaillist/unsubscribe/{token}
```

- Public (no auth required)
- Returns `204 No Content` on success
- Returns `404` if the token is invalid or already used

---

## 1. Update the Next.js API route

**File:** `frontend/app/api/emails/unsubscribe/route.ts`

Add a `GET` handler that proxies to the backend token endpoint:

```ts
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token vantar." }, { status: 400 });
  }

  const response = await fetch(`${API_BASE_URL}/emaillist/unsubscribe/${token}`, {
    method: "GET",
  });

  if (response.status === 404) {
    return NextResponse.json({ error: "Ógilt eða útrunnið afskráningartengi." }, { status: 404 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Ekki tókst að afskrá netfang." }, { status: response.status });
  }

  return NextResponse.json({ message: "Netfang afskráð af póstlista." }, { status: 200 });
}
```

---

## 2. Update the unsubscribe page

**File:** `frontend/app/unsubscribe/page.tsx`

When `?token=` is present in the URL, skip the form and auto-unsubscribe on mount:

```ts
useEffect(() => {
  const token = searchParams.get("token");
  if (token) {
    setStatus("loading");
    fetch(`/api/emails/unsubscribe?token=${token}`)
      .then((res) => {
        if (res.ok) {
          setStatus("success");
          setMessage("Netfangið þitt er ekki lengur á póstlistanum okkar.");
        } else {
          setStatus("error");
          setMessage("Ekki tókst að afskrá þig. Reyndu aftur síðar.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Ekki tókst að afskrá þig. Reyndu aftur síðar.");
      });
  }
}, [searchParams]);
```

When `status === "loading"` and a token was in the URL, show the loading spinner instead of the form (the existing `Suspense` fallback already handles this partially — just make sure the form isn't rendered while loading).

---

## How to add the unsubscribe link in an email template

Use the placeholder `{unsubscribe_url}` anywhere in the HTML — the backend replaces it with the recipient's unique unsubscribe link before sending.

```html
<a href="{unsubscribe_url}">Afskráðu þig af póstlista</a>
```

For example, a typical footer:

```html
<p style="font-size:12px;color:#888;">
  Viltu hætta að fá tölvupóst frá okkur?
  <a href="{unsubscribe_url}">Afskráðu þig hér</a>.
</p>
```

The placeholder is replaced per-recipient with a URL like:
`https://slodi.is/unsubscribe?token=550e8400-e29b-41d4-a716-446655440000`

> **Note:** The token is unique per subscriber and single-use — once clicked, the subscriber is removed and the link becomes invalid.
