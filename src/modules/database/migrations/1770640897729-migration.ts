import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1770640897729 implements MigrationInterface {
    name = 'Migration1770640897729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."domain_monitor_logs_status_enum" AS ENUM('SUCCESS', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "domain_monitor_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "isp" character varying(100) NOT NULL, "domain" character varying(255) NOT NULL, "status" "public"."domain_monitor_logs_status_enum" NOT NULL, "status_text" character varying(255) NOT NULL, "error" jsonb, "checked_at" TIMESTAMP WITH TIME ZONE NOT NULL, "reported_error" boolean, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f117596414192b6dfd170717f55" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fb839b0b217ac4649c802db792" ON "domain_monitor_logs" ("domain", "isp", "checked_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fb839b0b217ac4649c802db792"`);
        await queryRunner.query(`DROP TABLE "domain_monitor_logs"`);
        await queryRunner.query(`DROP TYPE "public"."domain_monitor_logs_status_enum"`);
    }

}
