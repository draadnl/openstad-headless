import { PageLayout } from '../../../../components/ui/page-layout';
import { Button } from '../../../../components/ui/button';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import React from 'react';
import useResources from '@/hooks/use-resources';
import { useRouter } from 'next/router';
import { ListHeading, Paragraph } from '@/components/ui/typography';
import { RemoveResourceDialog } from '@/components/dialog-resource-remove';
import { toast } from 'react-hot-toast';

export default function ProjectResources() {
  const router = useRouter();
  const { project } = router.query;
  const { data, error, isLoading, remove } = useResources(project as string);

  if (!data) return null;

  const exportData = (data: BlobPart, fileName: string, type: string) => {
    // Create a link and download the file
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  function transform() {
    const jsonData = JSON.stringify(data);
    exportData(jsonData, `resources.json`, "application/json");
  }

  return (
    <div>
      <PageLayout
        pageHeader="Resources"
        breadcrumbs={[
          {
            name: 'Projecten',
            url: '/projects',
          },
          {
            name: 'Resources',
            url: `/projects/${project}/resources`,
          },
        ]}
        action={
          <div className='flex flex-row w-full md:w-auto my-auto gap-4'>
            <Link
              href={`/projects/${project}/resources/create`}>
              <Button variant="default" className='text-xs p-2 w-fit'>
                <Plus size="20" className="hidden lg:flex" />
                Resource toevoegen
              </Button>
            </Link>
            <Button className="text-xs p-2 w-fit" type="submit" onClick={transform}>
              Exporteer resources
            </Button>
          </div>
        }>
        <div className="container py-6">
          <div className="p-6 bg-white rounded-md">
            <div className="grid grid-cols-2 lg:grid-cols-[40px_repeat(6,1fr)] items-center py-2 px-2 border-b border-border">
              <ListHeading className="hidden lg:flex">ID</ListHeading>
              <ListHeading className="hidden lg:flex">Resources</ListHeading>
              <ListHeading className="hidden lg:flex lg:col-span-1">
                Gestemd op ja
              </ListHeading>
              <ListHeading className="hidden lg:flex lg:col-span-1">
                Gestemd op nee
              </ListHeading>
              <ListHeading className="hidden lg:flex lg:col-span-1">
                Datum aangemaakt
              </ListHeading>
              <ListHeading className="hidden lg:flex lg:col-span-1 ml-auto"></ListHeading>
            </div>
            <ul>
              {data?.map((resource: any) => (
                <Link
                  href={`/projects/${project}/resources/${resource.id}`}
                  key={resource.id}>
                  <li className="grid grid-cols-2 lg:grid-cols-[40px_repeat(6,1fr)] py-3 px-2 hover:bg-muted hover:cursor-pointer transition-all duration-200 border-b">
                    <Paragraph className="my-auto -mr-16 lg:mr-0">
                      {resource.id}
                    </Paragraph>
                    <Paragraph className="my-auto -mr-16 lg:mr-0">
                      {resource.title}
                    </Paragraph>
                    <Paragraph className="hidden lg:flex truncate my-auto">
                      {resource.yes || 0}
                    </Paragraph>
                    <Paragraph className="hidden lg:flex truncate my-auto">
                      {resource.no || 0}
                    </Paragraph>
                    <Paragraph className="hidden lg:flex truncate my-auto lg:-mr-16">
                      {resource.createDateHumanized}
                    </Paragraph>

                    <div
                      className="hidden lg:flex ml-auto"
                      onClick={(e) => e.preventDefault()}>
                      <RemoveResourceDialog
                        header="Resource verwijderen"
                        message="Weet je zeker dat je deze resource wilt verwijderen?"
                        onDeleteAccepted={() =>
                          remove(resource.id)
                            .then(() =>
                              toast.success('Resource successvol verwijderd')
                            )
                            .catch((e) =>
                              toast.error('Resource kon niet worden verwijderd')
                            )
                        }
                      />
                    </div>
                    <Paragraph className="flex">
                      <ChevronRight
                        strokeWidth={1.5}
                        className="w-5 h-5 my-auto ml-auto"
                      />
                    </Paragraph>
                  </li>
                </Link>
              ))}
            </ul>
          </div>
        </div>
      </PageLayout>
    </div>
  );
}
