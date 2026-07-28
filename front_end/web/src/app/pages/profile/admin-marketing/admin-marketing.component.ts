import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import {
  MarketingFormat,
  MarketingPost,
  MarketingService,
  MarketingStatus,
} from '../../../core/marketing.service';

@Component({
  selector: 'app-admin-marketing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-marketing.component.html',
  styleUrl: './admin-marketing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMarketingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MarketingService);
  private readonly snack = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  posts: MarketingPost[] = [];
  selectedPost: MarketingPost | null = null;
  loading = false;
  saving = false;
  generating = false;
  publishingId: number | null = null;
  generatingImageId: number | null = null;
  modifyingId: number | null = null;
  deletingId: number | null = null;
  readonly generationProgress = signal(0);
  @ViewChild('progressLabel') private progressLabel?: ElementRef<HTMLElement>;
  @ViewChild('progressFill') private progressFill?: ElementRef<HTMLElement>;
  generationLabel = '';
  private generationTimer: ReturnType<typeof setInterval> | null = null;
  instagramConnected = false;
  instagramUsername: string | null = null;
  savingSchedule = false;

  readonly agentForm = this.fb.nonNullable.group({
    topic: [''],
    format: ['CAROUSEL' as MarketingFormat],
  });

  readonly scheduleForm = this.fb.nonNullable.group({
    enabled: [true],
    cadence: ['WEEKLY' as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'],
    dayOfWeek: [1],
    hour: [9],
    minute: [0],
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    caption: [
      'AquaManager centralise le suivi de votre aquarium pour vous aider à garder un bac stable. 🐠💧\n\n#AquaManager #Aquariophilie #Aquarium',
      [Validators.required, Validators.minLength(10), Validators.maxLength(5000)],
    ],
    format: ['CAROUSEL' as MarketingFormat, Validators.required],
    scheduledAt: [''],
    mediaUrl: [''],
    sourceUrl: ['https://aquamanager.fr'],
  });

  ngOnInit(): void {
    this.refresh();
    this.refreshInstagramStatus();
    this.loadSchedule();
  }

  loadSchedule(): void {
    this.api.getAgentSettings().subscribe({
      next: (settings) => {
        this.scheduleForm.patchValue(settings);
        this.cdr.markForCheck();
      },
      error: () => this.snack.open('Impossible de charger la planification', 'OK', { duration: 3000 }),
    });
  }

  saveSchedule(): void {
    this.savingSchedule = true;
    this.api.updateAgentSettings(this.scheduleForm.getRawValue())
      .pipe(finalize(() => {
        this.savingSchedule = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => this.snack.open('Planification automatique enregistrée', 'OK', { duration: 3000 }),
        error: () => this.snack.open('Planification impossible', 'OK', { duration: 4000 }),
      });
  }

  dayLabel(day: number): string {
    return ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][day] ?? 'jour';
  }

  cadenceLabel(value: string): string {
    return value === 'MONTHLY' ? 'chaque mois' : value === 'BIWEEKLY' ? 'toutes les 2 semaines' : 'chaque semaine';
  }

  twoDigits(value: number): string {
    return value.toString().padStart(2, '0');
  }

  get pendingCount(): number {
    return this.posts.filter((post) => post.status === 'PENDING_APPROVAL').length;
  }

  get scheduledCount(): number {
    return this.posts.filter((post) => Boolean(post.scheduledAt)).length;
  }

  refresh(): void {
    this.loading = true;
    this.api.list()
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          const selectedId = this.selectedPost?.id;
          this.selectedPost =
            posts.find((post) => post.id === selectedId) ??
            posts.find((post) => post.status === 'PENDING_APPROVAL') ??
            posts[0] ??
            null;
          this.cdr.markForCheck();
        },
        error: () => this.snack.open('Impossible de charger les publications', 'OK', { duration: 3000 }),
      });
  }

  askAgent(): void {
    if (this.generating || this.generationTimer !== null) return;

    const value = this.agentForm.getRawValue();
    this.generating = true;
    this.cdr.detectChanges();
    this.startGenerationProgress();
    this.api.generate(value.topic, 'POST')
      .pipe(finalize(() => {
        this.generating = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (post) => {
          this.completeGenerationProgress();
          this.selectedPost = post;
          this.snack.open(`Post complet généré : ${post.title}`, 'Voir', { duration: 4000 });
          this.agentForm.patchValue({ topic: '' });
          this.refresh();
        },
        error: (error) => {
          this.resetGenerationProgress();
          const message = error?.error?.message || "L'agent IA n'a pas pu créer de proposition";
          this.snack.open(message, 'OK', { duration: 5000 });
        },
      });
  }

  revise(post: MarketingPost): void {
    if (this.generating || this.modifyingId !== null || this.generationTimer !== null) return;

    const instruction = window.prompt(
      'Que doit modifier l’agent dans ce post ?',
      'Rendre le contenu plus précis et mieux adapté à AquaManager',
    );
    if (!instruction?.trim()) return;

    this.modifyingId = post.id;
    this.cdr.detectChanges();
    this.startGenerationProgress('Analyse de vos modifications…');
    this.api.revise(post.id, instruction.trim())
      .pipe(finalize(() => {
        this.modifyingId = null;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (revisedPost) => {
          this.completeGenerationProgress('Post modifié : vérifiez le nouveau résultat');
          this.selectedPost = revisedPost;
          this.snack.open('Le texte et l’image ont été actualisés', 'OK', { duration: 4000 });
          this.refresh();
        },
        error: (error) => {
          this.resetGenerationProgress();
          const message = error?.error?.message || 'Modification du post impossible';
          this.snack.open(message, 'OK', { duration: 6000 });
        },
      });
  }

  removeGeneratedPost(post: MarketingPost): void {
    if (
      !window.confirm(
        `Supprimer définitivement la proposition « ${post.title} » ?`,
      )
    ) return;

    this.deletingId = post.id;
    this.api.removeGeneratedPost(post.id)
      .pipe(finalize(() => {
        this.deletingId = null;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.posts = this.posts.filter((item) => item.id !== post.id);
          this.selectedPost =
            this.posts.find((item) => item.status === 'PENDING_APPROVAL') ??
            this.posts[0] ??
            null;
          this.snack.open('Proposition IA supprimée', 'OK', { duration: 3000 });
          this.cdr.markForCheck();
        },
        error: (error) => {
          const message = error?.error?.message || 'Suppression impossible';
          this.snack.open(message, 'OK', { duration: 5000 });
        },
      });
  }

  private startGenerationProgress(label = 'Analyse du sujet et des articles AquaManager…'): void {
    this.resetGenerationProgress();
    this.setGenerationProgress(8);
    this.generationLabel = label;
    this.generationTimer = setInterval(() => {
      if (this.generationProgress() < 35) {
        this.generationLabel = 'Rédaction du texte Instagram…';
      } else if (this.generationProgress() < 70) {
        this.generationLabel = 'Création du visuel AquaManager…';
      } else {
        this.generationLabel = 'Finalisation et contrôle anti-doublon…';
      }
      this.setGenerationProgress(Math.min(92, this.generationProgress() + 4));
      this.cdr.detectChanges();
    }, 1000);
    this.cdr.markForCheck();
  }

  private completeGenerationProgress(label = 'Post complet créé avec succès'): void {
    if (this.generationTimer) clearInterval(this.generationTimer);
    this.generationTimer = null;
    this.setGenerationProgress(100);
    this.generationLabel = label;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.setGenerationProgress(0);
      this.generationLabel = '';
      this.cdr.detectChanges();
    }, 1800);
  }

  private resetGenerationProgress(): void {
    if (this.generationTimer) clearInterval(this.generationTimer);
    this.generationTimer = null;
    this.setGenerationProgress(0);
    this.generationLabel = '';
    this.cdr.markForCheck();
  }

  private setGenerationProgress(progress: number): void {
    this.generationProgress.set(progress);
    if (this.progressLabel) {
      this.progressLabel.nativeElement.textContent = `${progress} %`;
    }
    if (this.progressFill) {
      this.progressFill.nativeElement.style.width = `${progress}%`;
    }
  }

  selectPost(post: MarketingPost): void {
    this.selectedPost = post;
    this.cdr.markForCheck();
  }

  refreshInstagramStatus(): void {
    this.api.instagramStatus().subscribe({
      next: (status) => {
        this.instagramConnected = status.connected;
        this.instagramUsername = status.username;
        this.cdr.markForCheck();
      },
      error: () => {
        this.instagramConnected = false;
        this.instagramUsername = null;
        this.cdr.markForCheck();
      },
    });
  }

  publish(post: MarketingPost): void {
    if (!this.instagramConnected || post.status !== 'APPROVED') return;
    this.publishingId = post.id;
    this.api.publish(post.id)
      .pipe(finalize(() => {
        this.publishingId = null;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.snack.open('Publication envoyée sur Instagram', 'OK', { duration: 3500 });
          this.refresh();
        },
        error: (error) => {
          const message = error?.error?.message || 'Publication Instagram impossible';
          this.snack.open(message, 'OK', { duration: 6000 });
        },
      });
  }

  generateImage(post: MarketingPost): void {
    this.generatingImageId = post.id;
    this.api.generateImage(post.id)
      .pipe(finalize(() => {
        this.generatingImageId = null;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.snack.open('Visuel généré : vérifiez-le avant approbation', 'OK', { duration: 4000 });
          this.refresh();
        },
        error: (error) => {
          const message = error?.error?.message || 'Génération du visuel impossible';
          this.snack.open(message, 'OK', { duration: 6000 });
        },
      });
  }

  save(status: 'DRAFT' | 'PENDING_APPROVAL'): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving = true;
    this.api.create({
      title: value.title.trim(),
      caption: value.caption.trim(),
      format: value.format,
      status,
      mediaUrl: value.mediaUrl.trim() || undefined,
      sourceUrl: value.sourceUrl.trim() || undefined,
      scheduledAt: value.scheduledAt ? new Date(value.scheduledAt).toISOString() : undefined,
    })
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.snack.open(status === 'DRAFT' ? 'Brouillon enregistré' : 'Envoyé pour validation', 'OK', { duration: 2500 });
          this.form.patchValue({ title: '', mediaUrl: '', scheduledAt: '' });
          this.refresh();
        },
        error: () => this.snack.open('Enregistrement impossible', 'OK', { duration: 3000 }),
      });
  }

  approve(post: MarketingPost): void {
    this.api.approve(post.id).subscribe({
      next: () => {
        this.snack.open('Publication approuvée', 'OK', { duration: 2200 });
        this.refresh();
      },
      error: () => this.snack.open('Validation impossible', 'OK', { duration: 3000 }),
    });
  }

  statusLabel(status: MarketingStatus): string {
    return {
      DRAFT: 'Brouillon',
      PENDING_APPROVAL: 'À valider',
      APPROVED: 'Approuvée',
      REJECTED: 'Refusée',
      PUBLISHED: 'Publiée',
    }[status];
  }

  formatLabel(format: MarketingFormat): string {
    return { POST: 'Publication', CAROUSEL: 'Carrousel', REEL: 'Reel', STORY: 'Story' }[format];
  }
}
