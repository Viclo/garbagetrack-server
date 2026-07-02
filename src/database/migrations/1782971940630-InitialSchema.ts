import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1782971940630 implements MigrationInterface {
  name = 'InitialSchema1782971940630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Baseline guard: databases created before migrations existed already
    // have this schema (built by TypeORM synchronize). Record the migration
    // as executed without touching them; the MultiTenantUpgrade migration
    // that follows handles their upgrade.
    if (await queryRunner.hasTable('admins')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(
      `CREATE TABLE "tenants" ("id" SERIAL NOT NULL, "slug" character varying NOT NULL, "name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "wa_phone_number_id" character varying, "wa_access_token" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE ("slug"), CONSTRAINT "UQ_a5b3df3aee85f0a5050657555b3" UNIQUE ("wa_phone_number_id"), CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "drivers" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "username" character varying NOT NULL, "password_hash" character varying NOT NULL, "name" character varying NOT NULL, "phone" character varying, "license_number" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_12b7ae6be889f41a28bec591848" UNIQUE ("username"), CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "trucks" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "name" character varying NOT NULL, "license_plate" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "driver_id" integer, CONSTRAINT "UQ_ef7756b1a15da5634ed00eadf53" UNIQUE ("tenant_id", "license_plate"), CONSTRAINT "UQ_678d1f305ddd84851466e295046" UNIQUE ("tenant_id", "name"), CONSTRAINT "PK_6a134fb7caa4fb476d8a6e035f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "truck_positions" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "current_segment_index" integer, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "truck_id" integer, CONSTRAINT "PK_733529a5c70e9b72dcf0ed308e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "route_segments" ("id" SERIAL NOT NULL, "segment_index" integer NOT NULL, "street_name" character varying NOT NULL, "start_latitude" double precision NOT NULL, "start_longitude" double precision NOT NULL, "end_latitude" double precision NOT NULL, "end_longitude" double precision NOT NULL, "path" jsonb, "geom" geometry(Point,4326), "route_id" integer, CONSTRAINT "PK_67f35163b4fb5b5e4c28d8847b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f99a4b3a85cff545f297a690ad" ON "route_segments" USING GiST ("geom") `,
    );
    await queryRunner.query(
      `CREATE TABLE "routes" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "name" character varying NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b8c68d1b24977703947231d8f5c" UNIQUE ("tenant_id", "name"), CONSTRAINT "PK_76100511cdfa1d013c859f01d8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "route_sessions" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ended_at" TIMESTAMP WITH TIME ZONE, "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL, "driver_id" integer, "truck_id" integer, "route_id" integer, CONSTRAINT "PK_a2099d17d1467177ce3e8842383" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e52fe3f2d17ee74d8d9e87bbb8" ON "route_sessions" ("ended_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."weekly_schedules_day_of_week_enum" AS ENUM('MON', 'TUE', 'WED', 'THU', 'FRI')`,
    );
    await queryRunner.query(
      `CREATE TABLE "weekly_schedules" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "day_of_week" "public"."weekly_schedules_day_of_week_enum" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "truck_id" integer, "route_id" integer, CONSTRAINT "UQ_0639abe87c6d762c1529ba272b5" UNIQUE ("truck_id", "day_of_week"), CONSTRAINT "PK_c14aa04ae270430a6eb8444108c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "system_configs" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "key" character varying NOT NULL, "value" character varying NOT NULL, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a81633c94224de0932f472f3507" UNIQUE ("tenant_id", "key"), CONSTRAINT "PK_29ac548e654c799fd885e1b9b71" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "residents" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "phone_number" character varying NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "geom" geometry(Point,4326), "segment_index" integer, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "route_id" integer, CONSTRAINT "UQ_15309edbde533fe51be89abcceb" UNIQUE ("tenant_id", "phone_number"), CONSTRAINT "PK_4c8d0413ee0e9a4ebbf500f7365" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notification_logs" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "sent_at" date NOT NULL, "message_status" character varying NOT NULL DEFAULT 'sent', "wa_message_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "resident_id" integer, "route_id" integer, CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "admins" ("id" SERIAL NOT NULL, "tenant_id" integer NOT NULL, "username" character varying NOT NULL, "password_hash" character varying NOT NULL, "name" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4ba6d0c734d53f8e1b2e24b6c56" UNIQUE ("username"), CONSTRAINT "PK_e3b38270c97a854c48d2e80874e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "drivers" ADD CONSTRAINT "FK_7793872525aa2c0a99f86601d2b" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trucks" ADD CONSTRAINT "FK_d92c3290754e1938143ff652c57" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "trucks" ADD CONSTRAINT "FK_df9c474095f43de64e840bc64df" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "truck_positions" ADD CONSTRAINT "FK_2fd8a632e6dffae1d068e450656" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "truck_positions" ADD CONSTRAINT "FK_b7fa812545984e2f1bd9ff28db2" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_segments" ADD CONSTRAINT "FK_a1f2367b973ba041eb3e679211b" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" ADD CONSTRAINT "FK_0d6d40672f21086d9bb090e5b1d" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" ADD CONSTRAINT "FK_08cf500f5a65c65afbb835ab02e" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" ADD CONSTRAINT "FK_ce52fc129c6eeb01ca9eef94d39" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" ADD CONSTRAINT "FK_90fe6151beeab02943e543be4e5" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" ADD CONSTRAINT "FK_ee9b2f63a67d9df755379451243" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_schedules" ADD CONSTRAINT "FK_a3bd31aa4ccb824bd97eb6f28dc" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_schedules" ADD CONSTRAINT "FK_d64b912459ac4ede0119f191b5a" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_schedules" ADD CONSTRAINT "FK_6dc39716057b17dda7e51decda8" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_configs" ADD CONSTRAINT "FK_74dd502343b6555fe5db2a52bf3" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD CONSTRAINT "FK_f22aa6150942ba06feb195b393b" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD CONSTRAINT "FK_2a746ce6f2df4d85192208de1e3" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_logs" ADD CONSTRAINT "FK_fe6690289c5e319b2ac0d809d72" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_logs" ADD CONSTRAINT "FK_bb7827a45edff4fcf7d1f86938f" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_logs" ADD CONSTRAINT "FK_cfc13417c5ecad27d5fcf4120bc" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "admins" ADD CONSTRAINT "FK_bce8274fc30027f8afbe61a2e56" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admins" DROP CONSTRAINT "FK_bce8274fc30027f8afbe61a2e56"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_logs" DROP CONSTRAINT "FK_cfc13417c5ecad27d5fcf4120bc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_logs" DROP CONSTRAINT "FK_bb7827a45edff4fcf7d1f86938f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_logs" DROP CONSTRAINT "FK_fe6690289c5e319b2ac0d809d72"`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" DROP CONSTRAINT "FK_2a746ce6f2df4d85192208de1e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" DROP CONSTRAINT "FK_f22aa6150942ba06feb195b393b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "system_configs" DROP CONSTRAINT "FK_74dd502343b6555fe5db2a52bf3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_schedules" DROP CONSTRAINT "FK_6dc39716057b17dda7e51decda8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_schedules" DROP CONSTRAINT "FK_d64b912459ac4ede0119f191b5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_schedules" DROP CONSTRAINT "FK_a3bd31aa4ccb824bd97eb6f28dc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" DROP CONSTRAINT "FK_ee9b2f63a67d9df755379451243"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" DROP CONSTRAINT "FK_90fe6151beeab02943e543be4e5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" DROP CONSTRAINT "FK_ce52fc129c6eeb01ca9eef94d39"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_sessions" DROP CONSTRAINT "FK_08cf500f5a65c65afbb835ab02e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" DROP CONSTRAINT "FK_0d6d40672f21086d9bb090e5b1d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_segments" DROP CONSTRAINT "FK_a1f2367b973ba041eb3e679211b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "truck_positions" DROP CONSTRAINT "FK_b7fa812545984e2f1bd9ff28db2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "truck_positions" DROP CONSTRAINT "FK_2fd8a632e6dffae1d068e450656"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trucks" DROP CONSTRAINT "FK_df9c474095f43de64e840bc64df"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trucks" DROP CONSTRAINT "FK_d92c3290754e1938143ff652c57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "drivers" DROP CONSTRAINT "FK_7793872525aa2c0a99f86601d2b"`,
    );
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TABLE "notification_logs"`);
    await queryRunner.query(`DROP TABLE "residents"`);
    await queryRunner.query(`DROP TABLE "system_configs"`);
    await queryRunner.query(`DROP TABLE "weekly_schedules"`);
    await queryRunner.query(`DROP TYPE "public"."weekly_schedules_day_of_week_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e52fe3f2d17ee74d8d9e87bbb8"`);
    await queryRunner.query(`DROP TABLE "route_sessions"`);
    await queryRunner.query(`DROP TABLE "routes"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f99a4b3a85cff545f297a690ad"`);
    await queryRunner.query(`DROP TABLE "route_segments"`);
    await queryRunner.query(`DROP TABLE "truck_positions"`);
    await queryRunner.query(`DROP TABLE "trucks"`);
    await queryRunner.query(`DROP TABLE "drivers"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
  }
}
