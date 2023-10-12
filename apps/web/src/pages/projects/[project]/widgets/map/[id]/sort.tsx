import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/typography";
import { useWidgetConfig } from "@/hooks/use-widget-config";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const sorting = [
  {
    id: "newest",
    label: "Nieuwste eerst",
  },
  {
    id: "oldest",
    label: "Oudste eerst",
  },
  {
    id: "title",
    label: "Titel",
  },
  {
    id: "random",
    label: "Willekeurig",
  },
  {
    id: "mostLikes",
    label: "Meeste likes",
  },
  {
    id: "leastLikes",
    label: "Minste likes",
  },
  {
    id: "mostReactions",
    label: "Meeste reacties",
  },
  {
    id: "leastReactions",
    label: "Minste reacties",
  },
  {
    id: "ranked",
    label: "Ranglijst",
  },
];

const formSchema = z.object({
  sorting: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one item.",
  }),
  defaultSorting: z.enum([
    "newest",
    "oldest",
    "title",
    "random",
    "mostLikes",
    "leastLikes",
    "mostReactions",
    "leastReactions",
    "ranked",
  ]),
});

type FormData = z.infer<typeof formSchema>;

export default function WidgetMapSort() {
  const category = "sort";

  const {
    data: widget,
    isLoading: isLoadingWidget,
    updateConfig,
  } = useWidgetConfig();

  const defaults = () => ({
    sorting: widget?.config?.[category]?.sorting || [],
    defaultSorting: widget?.config?.[category]?.defaultSorting || "newest",
  });

  async function onSubmit(values: FormData) {
    try {
      await updateConfig({ [category]: values });
    } catch (error) {
      console.error("could not update", error);
    }
  }

  const form = useForm<FormData>({
    resolver: zodResolver<any>(formSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    form.reset(defaults());
  }, [widget]);

  return (
    <div>
      <Form {...form}>
        <Heading size="xl" className="mb-4">
          Map • Sorteren
        </Heading>
        <Separator className="mb-4" />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="sorting"
            render={() => (
              <FormItem>
                <div>
                  <FormLabel>Selecteer uw gewenste sorteeropties</FormLabel>
                </div>
                {sorting.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="sorting"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={item.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
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
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="defaultSorting"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Selecteer de standaard manier van sorteren.
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Nieuwste eerst" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="newest">Nieuwste eerst</SelectItem>
                    <SelectItem value="oldest">Oudste eerst</SelectItem>
                    <SelectItem value="title">Titel</SelectItem>
                    <SelectItem value="random">Willekeurig</SelectItem>
                    <SelectItem value="mostLikes">Meeste likes</SelectItem>
                    <SelectItem value="leastLikes">Minste likes</SelectItem>
                    <SelectItem value="mostReactions">
                      Meeste reacties
                    </SelectItem>
                    <SelectItem value="leastReactions">
                      Minste reacties
                    </SelectItem>
                    <SelectItem value="ranked">Ranglijst</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="sticky bottom-0 py-4 bg-background border-t border-border flex flex-col">
            <Button className="self-end" type="submit">
              Opslaan
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}