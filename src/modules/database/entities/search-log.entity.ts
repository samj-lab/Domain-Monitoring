import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SearchStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

@Entity('search_logs')
@Index(['groupId', 'createdAt'])
export class SearchLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'varchar', length: 255 })
  groupId: string;

  @Column({ type: 'varchar', length: 255 })
  sender: string;

  @Column({ type: 'varchar', length: 500 })
  keyword: string;

  @Column({ name: 'results_count', type: 'int', default: 0 })
  resultsCount: number;

  @Column({ type: 'jsonb', nullable: true })
  results: Record<string, unknown>[] | null;

  @Column({ name: 'response_text', type: 'text', nullable: true })
  responseText: string | null;

  @Column({
    type: 'enum',
    enum: SearchStatus,
  })
  status: SearchStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
