import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum DomainStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity('domain_monitor_logs')
@Index(['domain', 'isp', 'checkedAt'])
export class DomainMonitorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  isp: string;

  @Column({ type: 'varchar', length: 255 })
  domain: string;

  @Column({
    type: 'enum',
    enum: DomainStatus,
  })
  status: DomainStatus;

  @Column({ name: 'status_text', type: 'varchar', length: 255 })
  statusText: string;

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown> | null;

  @Column({ name: 'checked_at', type: 'timestamptz' })
  checkedAt: Date;

  @Column({ name: 'reported_error', type: 'boolean', nullable: true })
  reportedError?: boolean | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
