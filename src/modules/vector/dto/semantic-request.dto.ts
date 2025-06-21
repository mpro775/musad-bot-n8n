import { IsString, MinLength } from 'class-validator';

export class SemanticRequestDto {
  @IsString()
  @MinLength(1)
  text: string;
}
