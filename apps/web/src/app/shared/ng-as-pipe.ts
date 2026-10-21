import { Pipe, PipeTransform } from "@angular/core";

@Pipe({ name: 'as', pure: true, standalone: true })
export class NgAsPipe implements PipeTransform {

  transform<T>(input: unknown, _baseItem: T | undefined): T {
    return input as unknown as T;
  }
}
