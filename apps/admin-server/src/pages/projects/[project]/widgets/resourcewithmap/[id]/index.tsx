import React from 'react';
import { PageLayout } from '../../../../../../components/ui/page-layout';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../../../../components/ui/tabs';
import { useRouter } from 'next/router';
import { useWidgetConfig } from '@/hooks/use-widget-config';
import { useWidgetPreview } from '@/hooks/useWidgetPreview';
import { ResourceOverviewWithMapWidgetProps } from '@openstad-headless/resource-overview-with-map/src/resourceOverviewWithMap';
import WidgetPreview from '@/components/widget-preview';
import WidgetPublish from '@/components/widget-publish';
import {
  WithApiUrlProps,
  withApiUrl,
} from '@/lib/server-side-props-definition';
import WidgetResourceOverviewSearch from '../../begrootmodule/[id]/search';
import WidgetResourceOverviewDisplay from '../../resourceoverview/[id]/display';
import WidgetResourceOverviewGeneral from '../../resourceoverview/[id]/general';
import WidgetResourceOverviewInclude from '../../resourceoverview/[id]/include';
import WidgetResourceOverviewPagination from '../../resourceoverview/[id]/pagination';
import WidgetResourceOverviewSorting from '../../resourceoverview/[id]/sorting';
import WidgetResourceOverviewTags from '../../resourceoverview/[id]/tags';
import WidgetResourcesMapButton from '../../resourcesmap/[id]/button';
import WidgetResourcesMapContent from '../../resourcesmap/[id]/content';
import WidgetResourcesMapCounter from '../../resourcesmap/[id]/counter';
import WidgetResourcesMapMaps from '../../resourcesmap/[id]/maps';
import { EditFieldProps } from '@/lib/form-widget-helpers/EditFieldProps';

export const getServerSideProps = withApiUrl;

export default function WidgetResourceOverview({ apiUrl }: WithApiUrlProps) {
  const router = useRouter();
  const id = router.query.id;
  const projectId = router.query.project as string;

  const { data: widget, updateConfig } =
    useWidgetConfig<ResourceOverviewWithMapWidgetProps>();
  const { previewConfig, updatePreview } =
    useWidgetPreview<ResourceOverviewWithMapWidgetProps>({
      projectId,
    });

  const totalPropPackage: ResourceOverviewWithMapWidgetProps & EditFieldProps<ResourceOverviewWithMapWidgetProps> = {
    ...(widget?.config || {}),
    ...(previewConfig || {}),
    updateConfig: (config: ResourceOverviewWithMapWidgetProps) =>
      updateConfig({ ...(widget?.config || {}), ...config }),


    onFieldChanged: (key: string, value: any) => {
      if (previewConfig) {
        updatePreview({
          ...previewConfig,
          [key]: value,
        });
      }
    },
    projectId,
  };

  return (
    <div>
      <PageLayout
        pageHeader="Project naam"
        breadcrumbs={[
          {
            name: 'Projecten',
            url: '/projects',
          },
          {
            name: 'Widgets',
            url: `/projects/${projectId}/widgets`,
          },
          {
            name: 'Resource Overview',
            url: `/projects/${projectId}/widgets/resourceoverview/${id}`,
          },
        ]}>
        <div className="container py-6">
          <Tabs defaultValue="general">
            <TabsList className="w-full bg-white border-b-0 mb-4 rounded-md h-fit flex flex-wrap overflow-auto">
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="map">Kaart</TabsTrigger>
              <TabsTrigger value="publish">Publiceren</TabsTrigger>
            </TabsList>
            {previewConfig ? (
              <>
                <TabsContent value="resources" className="extra-tabs">
                  <Tabs>
                    <TabsList className="w-full bg-white border-b-0 mb-4 rounded-md h-fit flex flex-wrap overflow-auto">
                      <TabsTrigger value="general">Algemeen</TabsTrigger>
                      <TabsTrigger value="display">Display</TabsTrigger>
                      <TabsTrigger value="tags">Tags</TabsTrigger>
                      <TabsTrigger value="search">Zoeken</TabsTrigger>
                      <TabsTrigger value="sorting">Sorteren</TabsTrigger>
                      <TabsTrigger value="pagination">Pagination</TabsTrigger>
                      <TabsTrigger value="include">Inclusief/exclusief</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="p-0">
                      <WidgetResourceOverviewGeneral {...totalPropPackage} />
                    </TabsContent>
                    <TabsContent value="display" className="p-0">
                      <WidgetResourceOverviewDisplay {...totalPropPackage} />
                    </TabsContent>
                    <TabsContent value="sorting" className="p-0">
                      <WidgetResourceOverviewSorting {...totalPropPackage} />
                    </TabsContent>
                    <TabsContent value="pagination" className="p-0">
                      <WidgetResourceOverviewPagination {...totalPropPackage} />
                    </TabsContent>
                    <TabsContent value="search" className="p-0">
                      <WidgetResourceOverviewSearch {...totalPropPackage} />
                    </TabsContent>
                    <TabsContent value="tags" className="p-0">
                      <WidgetResourceOverviewTags {...totalPropPackage} />
                    </TabsContent>
                    <TabsContent value="include" className="p-0">
                      <WidgetResourceOverviewInclude {...totalPropPackage} />
                    </TabsContent>
                    <TabsContent value="publish" className="p-0">
                      <WidgetPublish apiUrl={apiUrl} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="map">
                  <Tabs defaultValue="preview">
                    <TabsList className="w-full bg-white border-b-0 mb-4 rounded-md">
                      <TabsTrigger value="map">Map</TabsTrigger>
                      <TabsTrigger value="button">Call-To-Action knop</TabsTrigger>
                      <TabsTrigger value="counter">Teller</TabsTrigger>
                      <TabsTrigger value="content">Content</TabsTrigger>
                    </TabsList>

                    <TabsContent value="map" className="p-0">
                      <WidgetResourcesMapMaps />
                    </TabsContent>
                    <TabsContent value="button" className="p-0">
                      <WidgetResourcesMapButton />
                    </TabsContent>
                    <TabsContent value="counter" className="p-0">
                      <WidgetResourcesMapCounter />
                    </TabsContent>
                    <TabsContent value="content" className="p-0">
                      <WidgetResourcesMapContent />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="publish" className="p-0">
                  <WidgetPublish apiUrl={apiUrl} />
                </TabsContent>

              </>
            ) : null}
          </Tabs>

          <div className="py-6 mt-6 bg-white rounded-md">
            {previewConfig ? (
              <WidgetPreview
                type="resourcewithmap"
                config={previewConfig}
                projectId={projectId as string}
              />
            ) : null}
          </div>
        </div>
      </PageLayout>
    </div>
  );
}
