import { ProjectSettingProps, BaseProps } from '@openstad-headless/types';
import type { MapPropsType } from '../types/index';
import { MarkerIconType } from './marker-icon';
import { MarkerProps } from './marker-props';

export type EditorMapWidgetProps = BaseProps &
  ProjectSettingProps &
  MapPropsType & {
    fieldName: string;
    markerIcon: MarkerIconType;
    editorMarker?: MarkerProps;
    centerOnEditorMarker: boolean;
  };
