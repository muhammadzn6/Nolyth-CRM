import { Injectable, type ArgumentMetadata, type PipeTransform } from "@nestjs/common";
import { ValidationError } from "@orbit/backend";

type ParseResult =
  | { success: true; data: unknown }
  | { success: false; error: { issues: unknown } };

type StrictDto = {
  schema?: { safeParse(value: unknown): ParseResult };
};

@Injectable()
export class OrbitValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== "body") {
      return value;
    }

    const schema = (metadata.metatype as StrictDto | undefined)?.schema;

    if (!schema) {
      return value;
    }

    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      throw new ValidationError("The request payload is invalid", parsed.error.issues);
    }

    return parsed.data;
  }
}
