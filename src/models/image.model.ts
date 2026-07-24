import { ApiProperty } from "@nestjs/swagger";

export class ImageSlugDto {
  @ApiProperty()
  slug: string;
}

export class ImageTagDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  value: string;
}

export class TagDefinitionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  creationTime: Date;
}

export class CreateTagDefinitionDto {
  @ApiProperty()
  key: string;

  @ApiProperty({ required: false })
  description?: string;
}

export class ImageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  width: number;

  @ApiProperty()
  height: number;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  md5: string;

  @ApiProperty()
  hasAlpha: boolean;

  @ApiProperty()
  hasAnimation: boolean;

  @ApiProperty({
    required: false,
  })
  slugs?: Array<ImageSlugDto>;

  @ApiProperty()
  creationTime: Date;

  @ApiProperty()
  deletionTime: Date;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty({ required: false })
  externalId?: string;

  @ApiProperty({ required: false })
  tags?: Array<ImageTagDto>;
}

export class ImageTagInputDto {
  @ApiProperty()
  key: string;

  @ApiProperty({ required: false })
  value?: string;
}

export class PatchImageDto {
  @ApiProperty({ required: false })
  isPublic?: boolean;

  @ApiProperty({ required: false, type: [ImageTagInputDto] })
  tags?: ImageTagInputDto[];
}
