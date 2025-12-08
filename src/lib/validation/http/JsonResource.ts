export class JsonResource {
  public resource: any;

  constructor(resource: any) {
    this.resource = resource;
  }

  static make(resource: any): JsonResource {
    return new this(resource);
  }

  static collection(resource: any[]): AnonymousResourceCollection {
    return new AnonymousResourceCollection(resource, this);
  }

  resolve(request?: any): any {
    if (this.resource === null) {
      return null;
    }

    if (Array.isArray(this.resource)) {
      return this.resource.map((item) => {
        const instance = new (this.constructor as any)(item);
        return instance.toArray(request);
      });
    }

    return this.toArray(request);
  }

  toArray(request?: any): any {
    if (this.resource && typeof this.resource.toJSON === "function") {
      return this.resource.toJSON();
    }
    return this.resource;
  }
}

export class AnonymousResourceCollection extends JsonResource {
  public collects: any;

  constructor(resource: any[], collects: any) {
    super(resource);
    this.collects = collects;
  }

  resolve(request?: any): any {
    return this.resource.map((item: any) => {
      const instance = new this.collects(item);
      return instance.resolve(request);
    });
  }
}
