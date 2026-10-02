import { UploadDocument } from '@/hooks/upload-document';
import {
  GENERIC_UPLOAD_ERROR_MESSAGE,
  MAX_UPLOAD_SIZE_MB,
  UploadError,
  assertUploadableSize,
  performUpload,
} from '@/lib/upload-limits';
import { validateProjectNumber } from '@/lib/validateProjectNumber';
import React, { useEffect } from 'react';
import { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';

export const ImageUploader: React.FC<{
  form: UseFormReturn<any>;
  fieldName: Path<FieldValues>;
  onImageUploaded?: (imageObject: { url: string }) => void;
  imageLabel?: string;
  description?: string;
  allowedTypes?: string[];
  project?: string;
  allowMultiple?: boolean;
}> = ({
  form,
  fieldName,
  onImageUploaded,
  allowedTypes,
  imageLabel = 'Afbeelding',
  description = '',
  project,
  allowMultiple = false,
}) => {
  const [file, setFile] = React.useState<{ url: string }>();
  const [fileUrl, setFileUrl] = React.useState<string>('');

  function prepareFile(image: any) {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('filename', 'testName');
    formData.append('description', 'testDescription');

    return formData;
  }

  async function uploadImage(data: File) {
    let response;

    if (
      data &&
      (data.type === 'image/gif' ||
        data.type === 'image/x-icon' ||
        data.type === 'image/vnd.microsoft.icon')
    ) {
      response = await UploadDocument(data, project);
    } else {
      assertUploadableSize(data);

      const image = prepareFile(data);
      const projectNumber: number | undefined = validateProjectNumber(project);

      response = await performUpload(
        `/api/openstad/api/project/${projectNumber}/upload/image`,
        image
      );
    }

    setFile(response);
  }

  useEffect(() => {
    if (file && fileUrl !== file.url) {
      setFileUrl(file.url);
      form.setValue(fieldName, file.url);
      onImageUploaded && onImageUploaded(file);
    }
  }, [file, form, fieldName, onImageUploaded]);

  const acceptAttribute = allowedTypes ? allowedTypes.join(',') : '';

  return (
    <FormField
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{imageLabel}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormDescription>
            Maximale bestandsgrootte: {MAX_UPLOAD_SIZE_MB} MB
          </FormDescription>
          <FormControl>
            <Input
              type="file"
              accept={acceptAttribute}
              multiple={allowMultiple}
              ref={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                form.clearErrors(fieldName);
                try {
                  for (const file of Array.from(files)) {
                    await uploadImage(file);
                  }
                } catch (error) {
                  const message =
                    error instanceof UploadError
                      ? error.message
                      : GENERIC_UPLOAD_ERROR_MESSAGE;
                  form.setError(fieldName, { type: 'manual', message });
                }
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
