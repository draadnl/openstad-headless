import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Heading } from '@/components/ui/typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/router';
import useResources from '@/hooks/use-resources';
import { ResourceDetailWidgetProps } from '@openstad-headless/resource-detail/src/resource-detail';
import { EditFieldProps } from '@/lib/form-widget-helpers/EditFieldProps';
import { useCallback, useEffect } from 'react';
import { FormObjectSelectField } from '@/components/ui/form-object-select-field';
import { useFieldDebounce } from '@/hooks/useFieldDebounce';

const formSchema = z.object({
  resourceId: z.string().optional(),
  resourceIdRelativePath: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.includes('[id]'),
      'Specificeer een [id] veld'
    ),
});

export default function WidgetResourceDetailGeneral(
  props: ResourceDetailWidgetProps & EditFieldProps<ResourceDetailWidgetProps>
) {

  type FormData = z.infer<typeof formSchema>;
  async function onSubmit(values: FormData) {
    props.updateConfig({ ...props, ...values });
  }

  const router = useRouter();
  const projectId = router.query.project as string;
  const { data: resourceList } = useResources(projectId as string);
  const resources = resourceList as { id: string; title: string }[];

  const { onFieldChange } = useFieldDebounce(props.onFieldChanged);


  const defaults = useCallback(
    () => ({
      resourceId: props?.resourceId || undefined,
      resourceIdRelativePath: props?.resourceIdRelativePath || undefined
    }),
    [props?.resourceId]
  );

  const form = useForm<FormData>({
    resolver: zodResolver<any>(formSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    form.reset(defaults());
  }, [form, defaults]);

  return (
    <div className="p-6 bg-white rounded-md">
      <Form {...form}>
        <Heading size="xl">Algemeen</Heading>
        <Separator className="my-4" />
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 lg:w-1/2">
          <FormObjectSelectField
            form={form}
            fieldName="resourceId"
            fieldLabel="Koppel aan een specifieke resource"
            items={resources}
            keyForValue="id"
            label={(resource) => `${resource.id} ${resource.title}`}
            onFieldChanged={(e, key) => {
              props.onFieldChanged
            }}
            noSelection="Niet koppelen - beschrijf het path of gebruik queryparam openstadResourceId"
          />
            <FormField
              control={form.control}
              name="resourceIdRelativePath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Geen specifieke resource gekoppeld?
                  </FormLabel>
                  <em className="text-xs">Beschrijf hoe de resource gehaald wordt uit de url: (/pad/naar/[id]) of laat leeg om terug te vallen op ?openstadResourceId</em>
                  <FormControl>
                    <Input {...field} onChange={(e) => {
                      onFieldChange(field.name, e.target.value);
                      field.onChange(e);
                    }} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          <Button className="w-fit col-span-full" type="submit">
            Opslaan
          </Button>
        </form>
      </Form>
    </div>
  );
}
