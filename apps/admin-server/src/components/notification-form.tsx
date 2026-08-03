import { fetchSessionUser } from '@/auth-context';
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
import { Textarea } from '@/components/ui/textarea';
import { Heading } from '@/components/ui/typography';
import useNotificationTemplate, {
  useNotificationTemplateDefaults,
} from '@/hooks/use-notification-template';
import { useProject } from '@/hooks/use-project';
import { applyFilters } from '@/lib/nunjucks-filters';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/router';
import nunjucks from 'nunjucks';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import * as z from 'zod';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const nunjucksEnv = new nunjucks.Environment();
applyFilters(nunjucksEnv);

type Props = {
  type:
    | 'login email'
    | 'login sms'
    | 'new published resource - user feedback'
    | 'new published resource - admin update'
    | 'updated resource - user feedback'
    | 'user account about to expire'
    | 'new enquete - admin'
    | 'new enquete - user'
    | 'notification comment - user'
    | 'notification comment reply - user';
  engine?: 'email' | 'sms';
  id?: string;
  label?: string;
  subject?: string;
  body?: string;
};

const notificationTypes = {
  'login email': 'Inloggen via e-mail',
  'login sms': 'Inloggen via sms',
  'new published resource - user feedback':
    'Nieuwe resource gepubliceerd - Notificatie naar de gebruiker',
  'new published resource - admin update':
    'Nieuwe resource gepubliceerd - Notificatie naar de admin',
  'updated resource - user feedback':
    'Resource bijgewerkt - Notificatie naar de gebruiker',
  'user account about to expire':
    'Gebruikersaccount staat op het punt te verlopen',
  'new enquete - admin':
    'Nieuwe formulier inzending - Notificatie naar de admin',
  'new enquete - user':
    'Nieuwe formulier inzending - Notificatie naar de gebruiker',
  'notification comment - user':
    'Nieuwe reactie op een inzending - Notificatie naar de gebruiker',
  'notification comment reply - user':
    'Nieuwe reactie op een reactie - Notificatie naar de gebruiker',
};

const formSchema = z.object({
  engine: z.enum(['email', 'sms']),
  label: z
    .string()
    .min(1, {
      message: 'De label mag niet leeg zijn!',
    })
    .max(255, {
      message: 'De label mag niet langer dan 255 karakters zijn!',
    }),
  subject: z
    .string()
    .min(1, {
      message: 'Het onderwerp mag niet leeg zijn!',
    })
    .max(255, {
      message: 'Het onderwerp mag niet langer dan 255 karakters zijn!',
    }),
  body: z.string().min(1, {
    message: 'De inhoud mag niet leeg zijn!',
  }),
});

export function NotificationForm({
  type,
  engine,
  id,
  label,
  subject,
  body,
}: Props) {
  const router = useRouter();
  const project = router.query.project as string;
  const { data, create, update } = useNotificationTemplate(project as string);
  const { data: defaultTemplates } = useNotificationTemplateDefaults(
    project as string
  );
  const defaultTemplate = defaultTemplates?.find((d) => d.type === type);
  const notificationTitle = notificationTypes[type];
  const { data: projectData } = useProject();

  type MailContextType = {
    user: { name: string; fullName: string };
    name: string;
    loginurl: string;
    imagePath: string;
    logo: string;
    projectName: string;
    clientName: string;
    resource: any;
  };
  const [mailContext, setMailContext] = useState<MailContextType>({
    user: { name: 'Gebruiker', fullName: 'Gebruiker' },
    name: 'Gebruiker',
    loginurl: 'https://openstad.nl/login',
    imagePath: process.env.EMAIL_ASSETS_URL || '',
    logo: '',
    projectName: 'Voorbeeldproject',
    clientName: 'Voorbeeldklant',
    resource: {
      tags: [],
    },
  });

  useEffect(() => {
    async function setUserNameInMailContext() {
      const user = await fetchSessionUser();

      if (user && user.name) {
        setMailContext((prev: MailContextType) => {
          return {
            ...prev,
            user: { name: user.name, fullName: user.name },
            name: user.name,
          };
        });
      }
    }

    setUserNameInMailContext();
  }, []);

  useEffect(() => {
    if (!projectData) return;
    // clientName (the auth client name) is only resolvable server-side, so the
    // preview keeps a placeholder for it - see NotificationMessage.js.
    setMailContext((prev: MailContextType) => ({
      ...prev,
      logo: projectData.emailConfig?.styling?.logo || prev.logo,
      projectName: projectData.title || projectData.name || prev.projectName,
    }));
  }, [projectData]);

  const defaultValueBody = body || defaultTemplate?.body || '';

  const defaults = React.useCallback(
    () => ({
      engine: engine || 'email',
      label: label || defaultTemplate?.label || '',
      subject: subject || defaultTemplate?.subject || '',
      body: defaultValueBody,
    }),
    [engine, label, subject, defaultValueBody, defaultTemplate]
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver<any>(formSchema),
    defaultValues: defaults(),
  });

  const { watch } = form;
  const fieldValue = watch('body'); // Assuming 'engine' is the name of the field you're interested in

  useEffect(() => {
    form.reset(defaults(), { keepDirtyValues: true });
  }, [form, defaults]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (label && subject && body !== undefined) {
      const template = await update(
        id as string,
        values.label,
        values.subject,
        values.body
      );
      if (template) {
        toast.success('Template aangepast!');
      } else {
        toast.error('Er is helaas iets mis gegaan.');
      }
    } else {
      const template = await create(
        project,
        values.engine,
        type,
        values.label,
        values.subject,
        values.body
      );
      if (template) {
        toast.success('Template aangemaakt!');
      } else {
        toast.error('Er is helaas iets mis gegaan.');
      }
    }
  }

  const [mjmlHtml, setMjmlHtml] = useState('');

  function renderPreview(template: string) {
    try {
      return nunjucksEnv.renderString(template || '', mailContext);
    } catch (err) {
      return '';
    }
  }

  let mailTemplate: any = renderPreview(fieldValue || defaultValueBody || '');

  const [error, setError] = useState<string | null>(null);

  async function convertMJMLToHTML(data = mailTemplate) {
    if (data === '') {
      setMjmlHtml("<p style='text-align: center;'>Inhoud is leeg.</p>");
      return;
    }

    if (!String(data).includes('<mjml')) {
      setMjmlHtml(String(data));
      setError(null);
      return;
    }

    try {
      const mjml2html = (await import('mjml-browser')).default;
      const htmlOutput = (await mjml2html(data)).html;
      setMjmlHtml(htmlOutput);
      setError(null);
    } catch (err) {
      setError('Er is een fout opgetreden bij het renderen van de template.');
    }
  }

  useEffect(() => {
    convertMJMLToHTML();
  }, [mailContext]);

  const handleOnChange = (e: any, field: any) => {
    if (e.target.value.length > 0) {
      try {
        convertMJMLToHTML(
          nunjucksEnv.renderString(e.target.value, mailContext)
        );
      } catch (err) {
        setError('Er is een fout opgetreden bij het renderen van de template.');
      }
    }
  };

  useEffect(() => {
    if (fieldValue) {
      try {
        convertMJMLToHTML(nunjucksEnv.renderString(fieldValue, mailContext));
      } catch (err) {
        setError('Er is een fout opgetreden bij het renderen van de template.');
      }
    }
  }, [fieldValue]);

  const [confirmRestoreDefault, setConfirmRestoreDefault] = useState(false);

  useEffect(() => {
    if (!confirmRestoreDefault) return;
    const timeout = setTimeout(() => setConfirmRestoreDefault(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirmRestoreDefault]);

  function handleRestoreDefault() {
    if (!defaultTemplate) return;
    if (!confirmRestoreDefault) {
      setConfirmRestoreDefault(true);
      return;
    }
    form.reset({
      engine: engine || 'email',
      label: defaultTemplate.label,
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
    });
    setConfirmRestoreDefault(false);
  }

  return (
    <div>
      <div className="container px-0 py-6">
        <Form {...form} className="px-0 py-6 bg-white rounded-md">
          <Heading size="xl">{notificationTitle}</Heading>
          <Separator className="my-4" />
          <div className="grid grid-cols-2">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {label && subject && body !== undefined ? null : (
                <FormField
                  control={form.control}
                  name="engine"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>
                        Wat voor client gaat gebruikt worden voor dit onderdeel?
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="email" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label (Type bericht)</FormLabel>
                    <FormControl>
                      <Input placeholder="Label van de mail" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Onderwerp</FormLabel>
                    <FormControl>
                      <Input placeholder="Onderwerp van de mail" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inhoud</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Inhoud van de mail..."
                        defaultValue={
                          field.value.length > 0 ? field.value : body
                        }
                        rows={20}
                        onKeyUpCapture={(e) => handleOnChange(e, field)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={!!error}>
                  Opslaan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-live="polite"
                  disabled={!defaultTemplate}
                  onClick={handleRestoreDefault}>
                  {confirmRestoreDefault
                    ? 'Weet je het zeker?'
                    : 'Herstel standaard'}
                </Button>
              </div>
              {error && <p className="text-red-500">{error}</p>}
            </form>

            <div className="p-4">
              <iframe
                className="email-iframe"
                sandbox=""
                srcDoc={mjmlHtml}
                height={500}
                width={500}></iframe>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
