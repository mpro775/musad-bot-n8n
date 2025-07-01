import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export type ExtractResult = {
  name?: string;
  description?: string;
  images?: string[];
  price?: number;
  availability?: string;
};

@Injectable()
export class ExtractService {
  private readonly logger = new Logger(ExtractService.name);
  constructor(private readonly http: HttpService) {}

  async extractFromUrl(url: string): Promise<ExtractResult> {
    try {
      const resp = await firstValueFrom(
        this.http.get('http://extractor-service:8001/extract/', {
          params: { url },
        }),
      );
      return resp.data.data;
    } catch (err) {
      this.logger.error(`Extract failed for ${url}: ${err.message}`);
      return {};
    }
  }
}
