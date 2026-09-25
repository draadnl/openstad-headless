import DataStore from '@openstad-headless/data-store/src';
import { FormValue } from '@openstad-headless/form/src/form';
import NotificationProvider from '@openstad-headless/lib/NotificationProvider/notification-provider';
import NotificationService from '@openstad-headless/lib/NotificationProvider/notification-service';
import {
  AccordionProvider,
  FormField,
  FormFieldDescription,
  FormLabel,
  Paragraph,
  Textbox,
} from '@utrecht/component-library-react';
import {
  FilePondErrorDescription,
  FilePondFile,
  FilePondInitialFile,
} from 'filepond';
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';
import FilePondPluginImageExifOrientation from 'filepond-plugin-image-exif-orientation';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';
import 'filepond/dist/filepond.min.css';
import React, { FC, useEffect, useRef, useState } from 'react';
import { FilePond, registerPlugin } from 'react-filepond';

import { InfoImage } from '../../infoImage';
import RteContent from '../../rte-formatting/rte-content';
import { Spacer } from '../../spacer';
import './image-upload.css';
import {
  MockImageFile,
  buildImageValue,
  removeDescription,
  toDescriptionEntries,
  toMockImages,
  toUploadedImageName,
} from './value';

registerPlugin(
  FilePondPluginImageExifOrientation,
  FilePondPluginImagePreview,
  FilePondPluginFileValidateType
);

const filePondSettings = {
  labelIdle: 'Upload hier uw bestand(en)',
  labelInvalidField: 'Veld bevat ongeldige bestanden',
  labelFileWaitingForSize: 'Wachtend op grootte',
  labelFileSizeNotAvailable: 'Grootte niet beschikbaar',
  labelFileCountSingular: 'Bestand in lijst',
  labelFileCountPlural: 'Bestanden in lijst',
  labelFileLoading: 'Laden',
  labelFileAdded: 'Toegevoegd',
  labelFileLoadError: 'Fout bij het uploaden',
  labelFileRemoved: 'Verwijderd',
  labelFileRemoveError: 'Fout bij het verwijderen',
  labelFileProcessing: 'Uploaden',
  labelFileProcessingComplete: 'Afbeelding geladen',
  labelFileProcessingAborted: 'Upload geannuleerd',
  labelFileProcessingError: 'Fout tijdens uploaden',
  labelFileProcessingRevertError: 'Fout tijdens terugdraaien',
  labelTapToCancel: 'tik om te annuleren',
  labelTapToRetry: 'tik om opnieuw te proberen',
  labelTapToUndo: 'tik om ongedaan te maken',
  labelButtonRemoveItem: 'Verwijderen',
  labelButtonAbortItemLoad: 'Abort',
  labelButtonRetryItemLoad: 'Retry',
  labelButtonAbortItemProcessing: 'Verwijder',
  labelButtonUndoItemProcessing: 'Undo',
  labelButtonRetryItemProcessing: 'Retry',
  labelButtonProcessItem: 'Upload',
  labelFileTypeNotAllowed: 'Bestandstype is niet toegestaan',
  name: 'image',
  maxParallelUploads: 1,
};

export type ImageUploadProps = {
  title: string;
  overrideDefaultValue?: FormValue;
  description?: string;
  fieldRequired?: boolean;
  requiredWarning?: string;
  fieldKey: string;
  allowedTypes?: string[];
  disabled?: boolean;
  multiple?: boolean;
  maxUploadSizeMB?: number;
  // Lets the submitter add a remark to their own uploaded image (e.g. "this
  // image is AI-generated"), reusing the same `images[].description` field
  // an admin already fills in from the back office.
  allowImageDescription?: boolean;
  imageDescriptionLabel?: string;
  imageDescriptionMaxLength?: number;
  type?: string;
  onChange?: (
    e: {
      name: string;
      value: { name: string; url: string; description?: string }[];
      isInitial?: boolean;
    },
    triggerSetLastKey?: boolean
  ) => void;
  imageUrl?: string;
  showMoreInfo?: boolean;
  moreInfoButton?: string;
  moreInfoContent?: string;
  infoImage?: string;
  randomId?: string;
  fieldInvalid?: boolean;
  defaultValue?: string;
  prevPageText?: string;
  nextPageText?: string;
  fieldOptions?: { value: string; label: string }[];
  images?: Array<{
    url: string;
    name?: string;
    imageAlt?: string;
    imageDescription?: string;
  }>;
  createImageSlider?: boolean;
  imageClickable?: boolean;
};

const ImageUploadField: FC<ImageUploadProps> = ({
  title,
  description,
  fieldKey,
  fieldRequired = false,
  multiple = false,
  onChange,
  allowedTypes = ['image/*'],
  disabled = false,
  showMoreInfo = false,
  moreInfoButton = 'Meer informatie',
  moreInfoContent = '',
  infoImage = '',
  randomId = '',
  fieldInvalid = false,
  overrideDefaultValue = [],
  images = [],
  createImageSlider = false,
  imageClickable = false,
  allowImageDescription = false,
  imageDescriptionLabel = 'Opmerking bij deze afbeelding',
  imageDescriptionMaxLength = 500,
  ...props
}) => {
  const datastore = new DataStore(props);

  // Client-side upload limit (in MB). Falls back to 25 MB so existing widgets
  // without a stored value immediately get the new limit.
  const maxMB = props.maxUploadSizeMB ?? 25;
  const maxBytes = maxMB * 1024 * 1024;
  const notifyFailed = (message: string) =>
    NotificationService.addNotification(message, 'error');

  const initialValue: MockImageFile[] = toMockImages(overrideDefaultValue);

  const [files, setImages] = useState<FilePondFile[]>([]);
  const [mockImages, setMockImages] = useState<MockImageFile[]>(initialValue);
  const [uploadedImages, setUploadedImages] = useState<
    { name: string; url: string }[]
  >([]);

  // Prefill remarks already saved on this resource (e.g. one an admin wrote),
  // keyed by image url so the submitter sees them and can edit or clear them.
  const initialDescriptions: Record<string, string> = {};
  for (const mockImage of initialValue) {
    if (mockImage.description !== undefined) {
      initialDescriptions[mockImage.source] = mockImage.description;
    }
  }
  const [descriptions, setDescriptions] =
    useState<Record<string, string>>(initialDescriptions);

  class HtmlContent extends React.Component<{ html: any }> {
    render() {
      let { html } = this.props;
      return <RteContent content={html} unwrapSingleRootDiv={true} />;
    }
  }

  const didInitRef = useRef(false);
  useEffect(() => {
    const images = buildImageValue({
      uploadedImages,
      mockImages,
      descriptions,
    });

    if (onChange) {
      onChange({
        name: fieldKey,
        value: images,
        // The first emit is the mount initialisation, not a user interaction.
        isInitial: !didInitRef.current,
      });
    }
    didInitRef.current = true;
    // `descriptions` is included so typing a remark (which changes no
    // array length) also re-emits the value -- lengths alone would miss it.
  }, [
    uploadedImages.length,
    mockImages.length,
    descriptions,
    setImages,
    setUploadedImages,
  ]);

  const acceptAttribute = allowedTypes ? allowedTypes : '';

  function waitForElm(selector: any) {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver((mutations) => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  useEffect(() => {
    waitForElm('.filepond--browser').then((elm: any) => {
      const label = document.querySelectorAll('.filepond--drop-label > label');
      label.forEach((item: any) => {
        item.setAttribute('aria-hidden', 'false');
      });
    });
  }, []);

  const finalImages = Array.from(new Set([...mockImages, ...files]));

  // Display order for the remark boxes -- see toDescriptionEntries in
  // value.ts for how this was measured against FilePond's own thumbnail
  // order (newest upload on top, existing images below).
  const imageEntries = toDescriptionEntries(mockImages, uploadedImages);

  return (
    <FormField type="text">
      {title && (
        <Paragraph className="utrecht-form-field__label">
          <FormLabel htmlFor={randomId}>
            <RteContent
              content={title}
              unwrapSingleRootDiv={true}
              forceInline={true}
            />
          </FormLabel>
        </Paragraph>
      )}

      {description && (
        <FormFieldDescription>
          <RteContent content={description} unwrapSingleRootDiv={true} />
        </FormFieldDescription>
      )}

      <FormFieldDescription className="openstad-max-upload-size">
        Maximale bestandsgrootte: {maxMB} MB
      </FormFieldDescription>

      {showMoreInfo && (
        <>
          <AccordionProvider
            sections={[
              {
                headingLevel: 3,
                body: <HtmlContent html={moreInfoContent} />,
                expanded: undefined,
                label: moreInfoButton,
              },
            ]}
          />
          <Spacer size={1.5} />
        </>
      )}

      {InfoImage({
        imageFallback: infoImage || '',
        images: images,
        createImageSlider: createImageSlider,
        addSpacer: !!infoImage,
        imageClickable: imageClickable,
      })}

      <div className="utrecht-form-field__input">
        <FilePond
          files={finalImages as File[] | FilePondInitialFile[]}
          onupdatefiles={(fileItems: FilePondFile[]) => {
            const imagesExceptMockedImages = fileItems
              ?.map((img) => {
                const isMockedImages = mockImages?.find(
                  (mockImage) => mockImage.options.file.name === img.file.name
                );
                if (isMockedImages) {
                  return null;
                }
                return img;
              })
              .filter((img) => img !== null) as FilePondFile[];

            setImages(imagesExceptMockedImages);
          }}
          allowMultiple={multiple}
          server={{
            process: {
              url: props?.imageUrl + '/images',
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + datastore.api?.currentUserJWT,
              },
              onload: (response: any) => {
                const currentImages = [...uploadedImages];
                currentImages.push(JSON.parse(response)[0]);

                setUploadedImages(currentImages);

                return JSON.stringify(currentImages); // Dit heeft echt geen nut, maar het lost wel de TS problemen op
              },
            },
            fetch: props?.imageUrl + '/image',
            revert: null,
          }}
          onremovefile={(
            error: FilePondErrorDescription | null,
            file: FilePondFile
          ) => {
            const fileName = file?.file?.name;

            if (!!fileName) {
              const uploadImageFileName = toUploadedImageName(fileName);
              const fileIsInUploadedImages = uploadedImages.find(
                (item) => item.name === uploadImageFileName
              );

              const fileIsInMockImages = mockImages.find(
                (item) => item.options.file.name === fileName
              );

              if (fileIsInMockImages) {
                const updatedMockImages = mockImages.filter(
                  (item) => item.options.file.name !== fileName
                );
                setMockImages(updatedMockImages);
                setDescriptions((prev) =>
                  removeDescription(prev, fileIsInMockImages.source)
                );
                return;
              }

              if (!fileIsInUploadedImages) return;

              const updatedImages = uploadedImages.filter(
                (item) => item.name !== uploadImageFileName
              );
              setUploadedImages(updatedImages);
              setDescriptions((prev) =>
                removeDescription(prev, fileIsInUploadedImages.url)
              );

              const updatedFiles = files.filter(
                (item) => item.file.name !== fileName
              );
              setImages(updatedFiles);
            }
          }}
          id={randomId}
          required={fieldRequired}
          disabled={disabled}
          acceptedFileTypes={
            typeof acceptAttribute === 'string'
              ? [acceptAttribute]
              : acceptAttribute
          }
          beforeAddFile={(fileItem) => {
            return new Promise<boolean>((resolve, reject) => {
              if (fileItem.file.size > maxBytes) {
                reject(
                  `Het bestand is te groot. De maximale bestandsgrootte is ${maxMB} MB.`
                );
              } else {
                resolve(true);
              }
            }).catch((error) => {
              notifyFailed(error);
              return false;
            });
          }}
          aria-invalid={fieldInvalid}
          aria-describedby={`${randomId}_error`}
          {...filePondSettings}
        />
        <NotificationProvider />
      </div>

      {allowImageDescription && imageEntries.length > 0 && (
        <div className="openstad-image-descriptions">
          {imageEntries.map((image, index) => {
            const inputId = `${randomId}-image-description-${index}`;
            return (
              <FormField type="text" key={image.url}>
                <FormLabel htmlFor={inputId}>
                  {imageDescriptionLabel} ({image.name})
                </FormLabel>
                <div className="utrecht-form-field__input">
                  <Textbox
                    id={inputId}
                    name={`${fieldKey}-image-description-${index}`}
                    type="text"
                    maxLength={imageDescriptionMaxLength}
                    value={descriptions[image.url] ?? ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const nextValue = e.target.value;
                      setDescriptions((prev) => ({
                        ...prev,
                        [image.url]: nextValue,
                      }));
                    }}
                  />
                </div>
              </FormField>
            );
          })}
        </div>
      )}
    </FormField>
  );
};

export default ImageUploadField;
