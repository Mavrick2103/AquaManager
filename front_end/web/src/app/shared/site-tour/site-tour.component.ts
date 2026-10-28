import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, effect, HostListener, Inject, inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SiteTourService } from '../../core/site-tour.service';

@Component({ selector: 'app-site-tour', standalone: true, imports: [CommonModule, MatIconModule], templateUrl: './site-tour.component.html', styleUrls: ['./site-tour.component.scss'] })
export class SiteTourComponent implements OnDestroy {
  readonly tour = inject(SiteTourService);
  tooltipStyle: Record<string, string> = {};
  spotlightStyles: Array<Record<string, string>> = [];
  targetState: 'loading' | 'ready' | 'missing' = 'loading';
  private target: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer: ResizeObserver | null = null;
  private generation = 0;
  private destroyed = false;
  private retries = 0;
  private readonly scrollListener = (event: Event) => {
    this.updateViewport();
    if (!(event.target instanceof Element) || !event.target.closest('.tour-tooltip')) this.schedulePosition();
  };

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    if (isPlatformBrowser(platformId)) {
      document.addEventListener('scroll', this.scrollListener, true);
      window.visualViewport?.addEventListener('resize', this.scrollListener);
      window.visualViewport?.addEventListener('scroll', this.scrollListener);
    }
    effect(() => {
      const visible = this.tour.opened() && !this.tour.suspended();
      this.tour.step(); this.tour.refreshTarget(); this.tour.navigating();
      if (!isPlatformBrowser(this.platformId)) return;
      this.updateViewport();
      this.generation++;
      this.clearTarget();
      this.retries = 0;
      this.targetState = 'loading';
      if (visible && !this.tour.navigating()) {
        this.document.documentElement.classList.add('site-tour-active');
        const generation = this.generation;
        this.timer = setTimeout(() => this.findTarget(generation), 60);
      } else this.releaseLayout();
    });
  }

  get current() { return this.tour.steps[this.tour.step()]; }
  get isLast(): boolean { return this.tour.step() === this.tour.steps.length - 1; }
  get primaryLabel(): string {
    if (this.tour.currentComplete) return this.current.continueLabel ?? 'Continuer';
    if (this.current.waitForTargetClick && this.targetState === 'missing') return 'Continuer la visite';
    return this.current.actionLabel ?? 'Continuer';
  }
  get primaryDisabled(): boolean {
    return this.tour.navigating() || (!!this.current.selector && this.targetState === 'loading');
  }

  activate(): void {
    if (this.primaryDisabled) return;
    if (this.current.waitForTargetClick && !this.tour.currentComplete && this.targetState === 'ready' && this.target) {
      if (this.target.matches(':disabled') || this.target.getAttribute('aria-disabled') === 'true') return;
      this.target.click();
    } else void this.tour.next();
  }
  next(): void { void this.tour.next(); }
  previous(): void { void this.tour.previous(); }
  close(): void { this.clearTarget(); this.releaseLayout(); this.tour.close(); }

  @HostListener('window:resize') onResize(): void { this.updateViewport(); this.schedulePosition(); }
  @HostListener('document:keydown', ['$event']) onKeydown(event: KeyboardEvent): void {
    if (!this.tour.opened() || this.tour.suspended()) return;
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key !== 'Tab') return;
    const selector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
    const panel = this.panel();
    const candidates = [...(this.target ? [this.target, ...this.target.querySelectorAll<HTMLElement>(selector)] : []), ...(panel?.querySelectorAll<HTMLElement>(selector) ?? [])]
      .filter((element, index, all) => all.indexOf(element) === index && element.matches(selector) && element.getBoundingClientRect().height > 0 && element.getAttribute('aria-hidden') !== 'true');
    if (!candidates.length) return;
    const index = candidates.indexOf(this.document.activeElement as HTMLElement);
    const next = event.shiftKey ? (index <= 0 ? candidates.length - 1 : index - 1) : (index + 1) % candidates.length;
    event.preventDefault();
    candidates[next].focus({ preventScroll: true });
  }

  @HostListener('document:click', ['$event']) onDocumentClick(event: MouseEvent): void {
    if (!this.tour.opened() || this.tour.suspended() || !this.target || !(event.target instanceof Node)) return;
    if (this.target.contains(event.target)) this.tour.targetActivated(this.current.id);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearTarget();
    this.releaseLayout();
    if (isPlatformBrowser(this.platformId)) {
      this.document.removeEventListener('scroll', this.scrollListener, true);
      window.visualViewport?.removeEventListener('resize', this.scrollListener);
      window.visualViewport?.removeEventListener('scroll', this.scrollListener);
    }
  }

  private panel(): HTMLElement | null { return this.document.querySelector('app-site-tour .tour-tooltip'); }

  private findTarget(generation: number): void {
    if (this.destroyed || generation !== this.generation || !this.tour.opened() || this.tour.suspended()) return;
    const panel = this.panel();
    const target = this.current.selector ? this.document.querySelector<HTMLElement>(this.current.selector) : null;
    if (!panel || (this.current.selector && (!target || !target.getBoundingClientRect().height))) {
      if (++this.retries < 24) { this.timer = setTimeout(() => this.findTarget(generation), 125); return; }
      this.targetState = 'missing';
      this.position(false);
      this.focusHeading();
      return;
    }
    this.target = target;
    target?.classList.add('site-tour-target');
    this.targetState = 'ready';
    this.position(true);
    this.focusHeading();
    this.observer = new ResizeObserver(() => this.schedulePosition());
    this.observer.observe(panel);
    if (target) this.observer.observe(target);
  }

  private focusHeading(): void {
    this.panel()?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  private schedulePosition(): void {
    if (!this.tour.opened() || this.tour.suspended() || this.destroyed) return;
    if (this.targetState === 'loading') return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.position(false), 20);
  }

  private position(scroll: boolean): void {
    const panel = this.panel();
    if (!panel || !this.tour.opened() || this.tour.suspended()) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const offsetTop = viewport?.offsetTop ?? 0;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const compact = width <= 720 || height <= 520;
    const landscape = width > height && height <= 520;
    this.document.documentElement.style.setProperty('--site-tour-space', compact && !landscape ? `${panel.offsetHeight + 32}px` : '0px');
    if (compact) {
      const panelWidth = landscape ? Math.min(360, width * .48) : width - 16;
      this.tooltipStyle = { left: `${offsetLeft + (landscape ? width - panelWidth - 8 : 8)}px`, width: `${panelWidth}px`, bottom: `${Math.max(0, window.innerHeight - height - offsetTop) + 8}px` };
    } else if (!this.target) {
      this.tooltipStyle = { left: `${offsetLeft + width / 2}px`, top: `${offsetTop + height / 2}px`, bottom: 'auto', transform: 'translate(-50%, -50%)', width: `${Math.min(460, width - 32)}px` };
    }
    if (!this.target) { this.spotlightStyles = []; return; }
    if (scroll) {
      this.target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      const rect = this.target.getBoundingClientRect();
      const availableHeight = compact && !landscape ? height - panel.offsetHeight - 24 : height;
      const desiredTop = offsetTop + Math.max(80, (availableHeight - Math.min(rect.height, availableHeight - 96)) / 2);
      window.scrollBy({ top: rect.top - desiredTop, behavior: 'instant' });
    }
    const rect = this.target.getBoundingClientRect();
    const gap = 6;
    const top = Math.max(0, Math.min(window.innerHeight, rect.top - gap));
    const bottom = Math.max(top, Math.min(window.innerHeight, rect.bottom + gap));
    const left = Math.max(0, Math.min(window.innerWidth, rect.left - gap));
    const right = Math.max(left, Math.min(window.innerWidth, rect.right + gap));
    this.spotlightStyles = [
      { top: '0', left: '0', right: '0', height: `${top}px` },
      { top: `${bottom}px`, left: '0', right: '0', bottom: '0' },
      { top: `${top}px`, left: '0', width: `${left}px`, height: `${bottom - top}px` },
      { top: `${top}px`, left: `${right}px`, right: '0', height: `${bottom - top}px` },
    ];
    if (compact) return;
    const panelWidth = Math.min(390, width - 32);
    const panelHeight = panel.offsetHeight;
    const clampTop = (value: number) => Math.max(offsetTop + 12, Math.min(value, offsetTop + height - panelHeight - 12));
    let x = Math.max(offsetLeft + 12, Math.min(rect.left, offsetLeft + width - panelWidth - 12));
    let y = clampTop(rect.bottom + 18);
    if (offsetLeft + width - rect.right >= panelWidth + 28) {
      x = rect.right + 18; y = clampTop(rect.top);
    } else if (rect.left - offsetLeft >= panelWidth + 28) {
      x = rect.left - panelWidth - 18; y = clampTop(rect.top);
    } else if (offsetTop + height - rect.bottom < panelHeight + 28) y = clampTop(rect.top - panelHeight - 18);
    this.tooltipStyle = { left: `${x}px`, top: `${y}px`, bottom: 'auto', width: `${panelWidth}px` };
  }

  private clearTarget(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.observer?.disconnect();
    this.observer = null;
    this.target?.classList.remove('site-tour-target');
    this.target = null;
    this.spotlightStyles = [];
    this.tooltipStyle = {};
  }

  private releaseLayout(): void {
    this.document.documentElement.classList.remove('site-tour-active');
    this.document.documentElement.style.removeProperty('--site-tour-space');
    if (!this.tour.opened() || this.destroyed) {
      this.document.documentElement.style.removeProperty('--tour-viewport-height');
      this.document.documentElement.style.removeProperty('--tour-viewport-top');
    }
  }

  private updateViewport(): void {
    if (!this.tour.opened()) return;
    const viewport = window.visualViewport;
    this.document.documentElement.style.setProperty('--tour-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
    this.document.documentElement.style.setProperty('--tour-viewport-top', `${viewport?.offsetTop ?? 0}px`);
  }
}
