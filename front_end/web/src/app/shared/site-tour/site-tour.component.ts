import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, effect, HostListener, Inject, inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SiteTourService } from '../../core/site-tour.service';

@Component({ selector: 'app-site-tour', standalone: true, imports: [CommonModule, MatIconModule], templateUrl: './site-tour.component.html', styleUrls: ['./site-tour.component.scss'] })
export class SiteTourComponent implements OnDestroy {
  readonly tour = inject(SiteTourService);
  tooltipStyle: Record<string, string> = {};
  spotlightStyles: Array<Record<string, string>> = [];
  private target: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    effect(() => {
      this.tour.opened(); this.tour.step(); this.tour.refreshTarget();
      if (isPlatformBrowser(this.platformId)) this.schedulePosition();
    });
  }

  get current() { return this.tour.steps[this.tour.step()]; }
  get isLast(): boolean { return this.tour.step() === this.tour.steps.length - 1; }
  next(): void { void this.tour.next(); }
  previous(): void { void this.tour.previous(); }
  close(): void { this.clearTarget(); this.tour.close(); }

  @HostListener('window:resize') onResize(): void { if (this.tour.opened()) this.schedulePosition(); }
  @HostListener('window:scroll') onScroll(): void { if (this.tour.opened()) this.schedulePosition(); }
  @HostListener('document:keydown.escape') onEscape(): void { if (this.tour.opened()) this.close(); }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.tour.opened() || !this.current.waitForTargetClick || this.current.advanceManually || !this.target) return;
    if (this.target.contains(event.target as Node)) this.tour.targetActivated();
  }

  ngOnDestroy(): void { this.clearTarget(); if (this.timer) clearTimeout(this.timer); }

  private schedulePosition(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.position(), 80);
  }

  private position(): void {
    this.clearTarget();
    if (!this.tour.opened() || !this.current.selector) {
      this.tooltipStyle = {};
      this.spotlightStyles = [];
      return;
    }
    this.target = this.document.querySelector<HTMLElement>(this.current.selector);
    if (!this.target) { this.timer = setTimeout(() => this.position(), 200); return; }
    this.target.classList.add('site-tour-target');
    this.target.scrollIntoView({ behavior: 'auto', block: 'center' });
    const rect = this.target.getBoundingClientRect();
    const gap = 8;
    const topEdge = Math.max(0, rect.top - gap);
    const bottomEdge = Math.min(window.innerHeight, rect.bottom + gap);
    const leftEdge = Math.max(0, rect.left - gap);
    const rightEdge = Math.min(window.innerWidth, rect.right + gap);
    this.spotlightStyles = [
      { top: '0', left: '0', right: '0', height: `${topEdge}px` },
      { top: `${bottomEdge}px`, left: '0', right: '0', bottom: '0' },
      { top: `${topEdge}px`, left: '0', width: `${leftEdge}px`, height: `${Math.max(0, bottomEdge - topEdge)}px` },
      { top: `${topEdge}px`, left: `${rightEdge}px`, right: '0', height: `${Math.max(0, bottomEdge - topEdge)}px` },
    ];
    const width = Math.min(390, window.innerWidth - 24);
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const spaceBelow = window.innerHeight - rect.bottom;
    const centeredTop = Math.min(Math.max(12, rect.top + rect.height / 2 - 140), window.innerHeight - 292);

    if (window.innerWidth > 700 && spaceRight >= width + 28) {
      this.tooltipStyle = { width: `${width}px`, top: `${centeredTop}px`, left: `${rect.right + 18}px` };
    } else if (window.innerWidth > 700 && spaceLeft >= width + 28) {
      this.tooltipStyle = { width: `${width}px`, top: `${centeredTop}px`, left: `${rect.left - width - 18}px` };
    } else if (spaceBelow >= 285) {
      const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
      this.tooltipStyle = { width: `${width}px`, top: `${rect.bottom + 16}px`, left: `${left}px` };
    } else {
      const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
      this.tooltipStyle = { width: `${width}px`, bottom: '12px', left: `${left}px` };
    }
  }

  private clearTarget(): void {
    this.target?.classList.remove('site-tour-target');
    this.target = null;
    this.spotlightStyles = [];
  }
}
