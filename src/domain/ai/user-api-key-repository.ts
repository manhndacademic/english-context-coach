import { and, count, eq } from "drizzle-orm";
import { db, schema, type DbClient } from "@/db";
import { decryptApiKey, encryptApiKey, sha256 } from "@/lib/crypto";
import { verifyGeminiApiKey } from "./adapters/gemini-utils";

export const MAX_USER_KEYS = 10;

export interface AddUserApiKeyInput {
  name: string;
  apiKey: string;
  provider: "gemini";
}

export interface UserApiKeyRepository {
  add(
    userId: string,
    data: AddUserApiKeyInput
  ): Promise<{ success: true } | { success: false; error: string }>;
  delete(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }>;
  disable(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }>;
  enable(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }>;
  reverify(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }>;
  findById(
    userId: string,
    keyId: string
  ): Promise<typeof schema.userAiApiKeys.$inferSelect | null>;
  countForUser(userId: string): Promise<number>;
  checkDuplicate(userId: string, fingerprint: string): Promise<boolean>;
}

export class DrizzleUserApiKeyRepository implements UserApiKeyRepository {
  constructor(private dbClient: DbClient = db) {}

  async add(
    userId: string,
    data: AddUserApiKeyInput
  ): Promise<{ success: true } | { success: false; error: string }> {
    const existingCount = await this.countForUser(userId);
    if (existingCount >= MAX_USER_KEYS) {
      return {
        success: false,
        error: `Bạn chỉ có thể lưu tối đa ${MAX_USER_KEYS} API keys.`,
      };
    }

    const fingerprint = sha256(`${data.provider}:${data.apiKey}`);
    const duplicate = await this.checkDuplicate(userId, fingerprint);
    if (duplicate) {
      return { success: false, error: "Key này đã tồn tại." };
    }

    const verifyError = await verifyGeminiApiKey(data.apiKey);
    if (verifyError) {
      return {
        success: false,
        error: `Xác thực API Key thất bại: ${verifyError}`,
      };
    }

    await this.dbClient.insert(schema.userAiApiKeys).values({
      userId,
      provider: data.provider,
      name: data.name,
      encryptedKey: encryptApiKey(data.apiKey),
      keyFingerprint: fingerprint,
      status: "active",
    });

    return { success: true };
  }

  async delete(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const deleted = await this.dbClient
      .delete(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.id, keyId),
          eq(schema.userAiApiKeys.userId, userId)
        )
      )
      .returning({ id: schema.userAiApiKeys.id });

    if (deleted.length === 0) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    return { success: true };
  }

  async disable(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const updated = await this.dbClient
      .update(schema.userAiApiKeys)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(
        and(
          eq(schema.userAiApiKeys.id, keyId),
          eq(schema.userAiApiKeys.userId, userId)
        )
      )
      .returning({ id: schema.userAiApiKeys.id });

    if (updated.length === 0) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    return { success: true };
  }

  async enable(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const keyRow = await this.findById(userId, keyId);
    if (!keyRow) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    const rawKey = decryptApiKey(keyRow.encryptedKey);
    const verifyError = await verifyGeminiApiKey(rawKey);
    if (verifyError) {
      await this.dbClient
        .update(schema.userAiApiKeys)
        .set({
          status: "invalid",
          errorMessage: verifyError,
          rateLimitedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.userAiApiKeys.id, keyRow.id));

      return {
        success: false,
        error: `Không thể kích hoạt. Xác thực API Key thất bại: ${verifyError}`,
      };
    }

    await this.dbClient
      .update(schema.userAiApiKeys)
      .set({
        status: "active",
        errorMessage: null,
        rateLimitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userAiApiKeys.id, keyRow.id));

    return { success: true };
  }

  async reverify(
    userId: string,
    keyId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const keyRow = await this.findById(userId, keyId);
    if (!keyRow) {
      return {
        success: false,
        error: "Không tìm thấy API Key hoặc không có quyền.",
      };
    }

    const rawKey = decryptApiKey(keyRow.encryptedKey);
    const verifyError = await verifyGeminiApiKey(rawKey);
    await this.dbClient
      .update(schema.userAiApiKeys)
      .set({
        status: verifyError ? "invalid" : "active",
        errorMessage: verifyError,
        rateLimitedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userAiApiKeys.id, keyRow.id));

    if (verifyError) {
      return {
        success: false,
        error: `Xác thực API Key thất bại: ${verifyError}`,
      };
    }

    return { success: true };
  }

  async findById(userId: string, keyId: string) {
    const [row] = await this.dbClient
      .select()
      .from(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.id, keyId),
          eq(schema.userAiApiKeys.userId, userId)
        )
      )
      .limit(1);

    return row ?? null;
  }

  async countForUser(userId: string): Promise<number> {
    const [{ value }] = await this.dbClient
      .select({ value: count() })
      .from(schema.userAiApiKeys)
      .where(eq(schema.userAiApiKeys.userId, userId));

    return value;
  }

  async checkDuplicate(userId: string, fingerprint: string): Promise<boolean> {
    const [duplicate] = await this.dbClient
      .select({ id: schema.userAiApiKeys.id })
      .from(schema.userAiApiKeys)
      .where(
        and(
          eq(schema.userAiApiKeys.userId, userId),
          eq(schema.userAiApiKeys.keyFingerprint, fingerprint)
        )
      )
      .limit(1);

    return Boolean(duplicate);
  }
}
