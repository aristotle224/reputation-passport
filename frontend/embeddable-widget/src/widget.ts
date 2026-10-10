/**
 * Embeddable reputation badge — drop-in web component for third-party pages.
 *
 * Uses the browser's native Custom Elements API so it works without any
 * framework.  Consumes the reputation-passport verification API via
 * @reputation-passport/widget (inlined here so this bundle is self-contained).
 *
 * Usage — drop into any HTML page:
 * ```html
 * <script src="widget.js"></script>
 * <reputation-badge
 *   address="GABC…"
 *   backend-url="https://api.reputation-passport.example.com"
 * ></reputation-badge>
 * ```
 *
 * Attributes:
 *   address       — the worker's Stellar G-address (required)
 *   backend-url   — base URL of the verification API (required)
 *   compact       — if present, renders a single-line compact badge
 */

interface WorkerProfile {
  score: number;
  breakdown: Record<string, number>;
  attestationCount: number;
  algorithmVersion: string;
}

/** Fetch a worker's score from the verification API. */
async function fetchScore(backendUrl: string, address: string): Promise<WorkerProfile> {
  const url = `${backendUrl.replace(/\/$/, '')}/api/v1/verification/profile/${encodeURIComponent(address)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<WorkerProfile>;
}

/** Fill a percentage-based star bar. */
function starPercent(score: number): number {
  return Math.round((score / 5) * 100);
}

const STYLES = `
  :host { display: inline-block; font-family: system-ui, sans-serif; }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 16px;
    min-width: 200px;
  }

  .badge.loading, .badge.error { color: #a0aec0; font-size: 13px; gap: 0; }

  .badge-logo { font-size: 22px; }

  .badge-body { display: flex; flex-direction: column; gap: 2px; }

  .score-row { display: flex; align-items: center; gap: 6px; }

  .score-val { font-size: 22px; font-weight: 700; color: #2d3748; line-height: 1; }

  .score-max { font-size: 13px; color: #a0aec0; }

  .star-wrap { position: relative; font-size: 16px; letter-spacing: 2px; }
  .stars-bg  { color: #e2e8f0; }
  .stars-fg  {
    position: absolute; top: 0; left: 0; overflow: hidden;
    color: #f6ad55; white-space: nowrap;
  }

  .meta { font-size: 11px; color: #a0aec0; }

  /* Compact variant */
  :host([compact]) .badge { min-width: unset; padding: 6px 12px; gap: 6px; }
  :host([compact]) .score-val { font-size: 17px; }
  :host([compact]) .meta { display: none; }
`;

class ReputationBadgeElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['address', 'backend-url', 'compact'];
  }

  private _shadow: ShadowRoot;
  private _loading = false;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this._render({ state: 'loading' });
    this._load();
  }

  attributeChangedCallback(): void {
    if (!this._loading) this._load();
  }

  private async _load(): Promise<void> {
    const address = this.getAttribute('address');
    const backendUrl = this.getAttribute('backend-url');
    if (!address || !backendUrl) {
      this._render({ state: 'error', message: 'Missing address or backend-url attribute.' });
      return;
    }

    this._loading = true;
    this._render({ state: 'loading' });
    try {
      const profile = await fetchScore(backendUrl, address);
      this._render({ state: 'loaded', profile });
    } catch (err) {
      this._render({ state: 'error', message: (err as Error).message });
    } finally {
      this._loading = false;
    }
  }

  private _render(
    ctx:
      | { state: 'loading' }
      | { state: 'error'; message: string }
      | { state: 'loaded'; profile: WorkerProfile },
  ): void {
    const style = document.createElement('style');
    style.textContent = STYLES;

    let badgeHtml: string;

    if (ctx.state === 'loading') {
      badgeHtml = `<div class="badge loading" role="status" aria-live="polite">Loading…</div>`;
    } else if (ctx.state === 'error') {
      badgeHtml = `<div class="badge error" role="alert" title="${escHtml(ctx.message)}">Unable to load score</div>`;
    } else {
      const { profile } = ctx;
      const pct = starPercent(profile.score);
      const attestLabel =
        profile.attestationCount === 1
          ? '1 attestation'
          : `${profile.attestationCount} attestations`;

      badgeHtml = `
        <div class="badge" role="img" aria-label="Reputation score ${profile.score} out of 5">
          <span class="badge-logo" aria-hidden="true">🛂</span>
          <div class="badge-body">
            <div class="score-row">
              <span class="score-val">${escHtml(String(profile.score))}</span>
              <span class="score-max">/ 5</span>
              <div class="star-wrap" aria-hidden="true">
                <div class="stars-bg">★★★★★</div>
                <div class="stars-fg" style="width:${pct}%">★★★★★</div>
              </div>
            </div>
            <div class="meta">${escHtml(attestLabel)} · ${escHtml(profile.algorithmVersion)}</div>
          </div>
        </div>
      `;
    }

    this._shadow.innerHTML = '';
    this._shadow.appendChild(style);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = badgeHtml;
    while (wrapper.firstChild) {
      this._shadow.appendChild(wrapper.firstChild);
    }
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Register the custom element if not already defined.
if (!customElements.get('reputation-badge')) {
  customElements.define('reputation-badge', ReputationBadgeElement);
}

// Also expose as a module export for Angular/other framework consumers.
export { ReputationBadgeElement };
