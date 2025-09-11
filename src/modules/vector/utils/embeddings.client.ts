// src/vector/embeddings.client.ts
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom, timeout, catchError, retry, delay } from 'rxjs';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class EmbeddingsClient {
  private readonly logger = new Logger(EmbeddingsClient.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(
    private readonly http: HttpService,
    private readonly i18n: I18nService,
  ) {}

  async embed(
    baseUrl: string,
    text: string,
    expected = 384,
  ): Promise<number[]> {
    // Input validation
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error(
        await this.i18n.translate('embeddings.errors.invalidBaseUrl'),
      );
    }

    if (!text || typeof text !== 'string') {
      throw new Error(
        await this.i18n.translate('embeddings.errors.invalidText'),
      );
    }

    if (text.length > 10000) {
      this.logger.warn(`Text length ${text.length} exceeds recommended limit`);
    }

    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Embedding attempt ${attempt}/${this.maxRetries} for text length ${text.length}`,
        );

        const { data } = await firstValueFrom(
          this.http
            .post<{
              embeddings: number[][];
            }>(
              `${baseUrl}/embed`,
              { texts: [text] },
              {
                timeout: 15_000,
                headers: {
                  'Content-Type': 'application/json',
                },
              },
            )
            .pipe(
              timeout(20_000),
              catchError((error) => {
                this.logger.warn(
                  `Embedding attempt ${attempt} failed:`,
                  error.message,
                );
                throw error;
              }),
            ),
        );

        const vec = data?.embeddings?.[0];
        if (!Array.isArray(vec) || vec.length !== expected) {
          throw new Error(
            await this.i18n.translate(
              'embeddings.errors.invalidEmbeddingLength',
              {
                args: { got: vec?.length || 0, expected },
              },
            ),
          );
        }

        this.logger.debug(
          `Successfully generated embedding of length ${vec.length}`,
        );
        return vec;
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries) {
          const delayMs = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.warn(
            `Embedding attempt ${attempt} failed, retrying in ${delayMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    this.logger.error(
      `All ${this.maxRetries} embedding attempts failed`,
      lastError,
    );
    throw new Error(
      await this.i18n.translate('embeddings.errors.allAttemptsFailed'),
    );
  }
}
