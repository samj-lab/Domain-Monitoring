import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1770747987521 implements MigrationInterface {
    name = 'Migration1770747987521'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."search_logs_status_enum" AS ENUM('SUCCESS', 'ERROR')`);
        await queryRunner.query(`CREATE TABLE "search_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" character varying(255) NOT NULL, "sender" character varying(255) NOT NULL, "keyword" character varying(500) NOT NULL, "results_count" integer NOT NULL DEFAULT '0', "results" jsonb, "response_text" text, "status" "public"."search_logs_status_enum" NOT NULL, "error_message" text, "duration_ms" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a7de6b052b1a608961dc46e843d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9bb607f993c11497bfde7fa1e6" ON "search_logs" ("group_id", "created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_9bb607f993c11497bfde7fa1e6"`);
        await queryRunner.query(`DROP TABLE "search_logs"`);
        await queryRunner.query(`DROP TYPE "public"."search_logs_status_enum"`);
    }

}
