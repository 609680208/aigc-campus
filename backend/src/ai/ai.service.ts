import { Injectable } from '@nestjs/common';
import { GenInput, GenResult, AiProvider } from './providers';

@Injectable()
export class AiService {
  async generate(model: any, input: GenInput): Promise<GenResult> {
    return new AiProvider().generate(model, input);
  }
}