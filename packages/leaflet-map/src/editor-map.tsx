import { useState, useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import type { LeafletMouseEvent } from 'leaflet';
import { loadWidget } from '../../lib/load-widget';
import parseLocation from './lib/parse-location';

import 'leaflet/dist/leaflet.css';
import './css/base-map.css';

import type { BaseProps } from '../../types/base-props';
import type { ProjectSettingProps } from '../../types/project-setting-props';
import type { MarkerProps } from './types/marker-props';
import type { MarkerIconType } from './types/marker-icon';
import type { MapPropsType } from './types/index';

import { BaseMap } from './base-map';
import React from 'react';

export type EditorMapWidgetProps = BaseProps &
  ProjectSettingProps &
  MapPropsType & {
    fieldName: string;
    markerIcon: MarkerIconType;
    editorMarker?: MarkerProps;
    centerOnEditorMarker: boolean;
  };

const EditorMap = ({
  fieldName = 'location',
  centerOnEditorMarker = true,
  editorMarker = undefined,
  markerIcon = {
    iconUrl: '/img/editor-marker-icon.svg',
    shadowUrl: '/img/marker-shadow.png',
    iconSize: [32, 40],
    iconAnchor: [8, 40],
  },
  center = undefined,
  markers = [],
  ...props
}: PropsWithChildren<EditorMapWidgetProps>) => {
  let [currentEditorMarker, setCurrentEditorMarker] = useState<MarkerProps>({
    ...editorMarker,
    icon: editorMarker?.icon || markerIcon,
    doNotCluster: true,
  });
  parseLocation(currentEditorMarker); // unify location format

  let [currentCenter, setCurrentCenter] = useState(center);

  useEffect(() => {
    if (centerOnEditorMarker && currentEditorMarker.lat) {
      setCurrentCenter({ ...currentEditorMarker });
    } else {
      setCurrentCenter(center);
    }
  }, [currentEditorMarker, center, centerOnEditorMarker]);

  function updateLocation(
    e: LeafletMouseEvent & { isInArea: boolean },
    map: any
  ) {
    if (map && e.isInArea) {
      setCurrentEditorMarker({
        ...currentEditorMarker,
        lat: e.latlng?.lat,
        lng: e.latlng?.lng,
      });
    }
  }

  return (
    <>
      <BaseMap
        {...props}
        center={currentCenter}
        markers={[...markers, currentEditorMarker]}
        onClick={updateLocation}
      />

      <input
        name={fieldName}
        type="hidden"
        value={`{"lat":${currentEditorMarker.lat},"lng":${currentEditorMarker.lng}}`}
      />
    </>
  );
};

EditorMap.loadWidget = loadWidget;
export { EditorMap };
