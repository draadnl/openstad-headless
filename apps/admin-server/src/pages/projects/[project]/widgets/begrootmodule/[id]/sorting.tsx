import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Heading } from '@/components/ui/typography';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useWidgetConfig } from '@/hooks/use-widget-config';
import { useCallback, useEffect } from 'react';

const sorting = [
  {
    id: 'newest',
    label: 'Nieuwste eerst',
  },
  {
    id: 'oldest',
    label: 'Oudste eerst',
  },
  {
    id: 'random',
    label: 'Willekeurig',
  },
  {
    id: 'mostLikes',
    label: 'Meeste likes',
  },
  {
    id: 'leastLikes',
    label: 'Minste likes',
  },
  {
    id: 'ranked',
    label: 'Ranglijst',
  },
  {
    id: 'highestCost',
    label: 'Hoogste bedrag',
  },
  {
    id: 'lowestCost',
    label: 'Laagste bedrag',
  },
];

const formSchema = z.object({
  sorting: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one item.',
  }),
  defaultSorting: z.enum([
    'newest',
    'oldest',
    'random',
    'mostLikes',
    'leastLikes',
    'ranked',
    'highestCost',
    'lowestCost',
  ]),
});

export default function BegrootmoduleSorting() {
  const category = 'sorting';

  const {
    data: widget,
    isLoading: isLoadingWidget,
    updateConfig,
  } = useWidgetConfig();

  const defaults = useCallback(
    () => ({
      sorting: widget?.config?.[category]?.options || [],
      defaultSorting: widget?.config?.[category]?.defaultSorting || 'newest',
    }),
    [widget?.config]
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver<any>(formSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    form.reset(defaults());
  }, [form, defaults]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateConfig({ [category]: values });
  }

  return (
    <div className="p-6 bg-white rounded-md">
      <Form {...form}>
        <Heading size="xl">Sorteer Opties</Heading>
        <Separator className="my-4" />
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="lg:w-3/4 grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="sorting"
            render={() => (
              <FormItem>
                <div>
                  <FormLabel>Selecteer uw gewenste sorteeropties</FormLabel>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-2 gap-x-4">
                  {sorting.map((item) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name="sorting"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked: any) => {
                                  return checked
                                    ? field.onChange([...field.value, item.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== item.id
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.label}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="defaultSorting"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Minimum budget dat geselecteerd moet worden
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nieuwste eerst" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Nieuwste eerst</SelectItem>
                    <SelectItem value="oldest">Oudste eerst</SelectItem>
                    <SelectItem value="random">Willekeurig</SelectItem>
                    <SelectItem value="mostLikes">Meeste likes</SelectItem>
                    <SelectItem value="leastLikes">Minste likes</SelectItem>
                    <SelectItem value="ranked">Ranglijst</SelectItem>
                    <SelectItem value="highestCost">Hoogste bedrag</SelectItem>
                    <SelectItem value="lowestCost">Laagste bedrag</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <Button type="submit">Opslaan</Button>
        </form>
      </Form>
    </div>
  );
}
