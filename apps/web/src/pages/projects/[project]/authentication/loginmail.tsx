import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';

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
import { Textarea } from '@/components/ui/textarea';
import { PageLayout } from '@/components/ui/page-layout';
import { Heading } from '@/components/ui/typography';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  title: z.string(),
  description: z.string(),
  label: z.string(),
  buttonText: z.string(),
  helpText: z.string(),
  mailSubject: z.string(),
  mailTemplate: z.string(),
});

export default function ProjectAuthenticationLoginMail() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver<any>(formSchema),
    defaultValues: {},
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <div>
      <PageLayout
        pageHeader="Projecten"
        breadcrumbs={[
          {
            name: 'Projecten',
            url: '/projects',
          },
          {
            name: 'Authenticatie',
            url: '/projects/1/authentication',
          },
          {
            name: 'Login E-mail',
            url: '/projects/1/authentication/loginmail',
          },
        ]}>
        <div className="container py-6">
          <div className="p-6 bg-white rounded-md">
            <Form {...form}>
              <Heading size="xl">Login e-mail</Heading>
              <Separator className="my-4" />
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 lg:w-1/2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titel</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschrijving</FormLabel>
                      <FormControl>
                        <Textarea placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buttonText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Knoptekst</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="helpText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hulptekst</FormLabel>
                      <FormControl>
                        <Textarea placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mailSubject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mail onderwerp</FormLabel>
                      <FormControl>
                        <Input placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mailTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mail template</FormLabel>
                      <FormControl>
                        <Textarea placeholder="" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">Opslaan</Button>
              </form>
            </Form>
          </div>
        </div>
      </PageLayout>
    </div>
  );
}
