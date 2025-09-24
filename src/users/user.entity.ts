/**
 * user.entity.ts
 * ----------------
 * Entité User = modèle de la table `users` dans MySQL.
 * Colonnes :
 * - id (PK auto-incrémentée)
 * - email (unique)
 * - password (hashé, non retourné par défaut)
 * - role (USER/ADMIN)
 * - createdAt / updatedAt (timestamps automatiques)
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 190 })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
