import { DateRangeBar } from '@/components/statistics/date-range-bar';
import { EnqueteStatistics } from '@/components/statistics/enquete/enquete-statistics';
import { SubmissionsAreaChart } from '@/components/statistics/submissions-area-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageLayout } from '@/components/ui/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInViewOnce, useReducedMotion } from '@/lib/statistics/chart-motion';
import {
  type StatsData,
  getCount,
  getStatByKey,
  getTimeSeries,
} from '@/lib/statistics/stats-helpers';
import { format, parseISO, subMonths } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef, useState } from 'react';

function AnimatedNumber({
  value,
  duration = 400,
}: {
  value: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const visible = useInViewOnce(spanRef);
  // Counts up the first time the card is seen; reduced motion shows it at once.
  const [display, setDisplay] = useState(reduced ? value : 0);
  const prevValue = useRef(reduced ? value : 0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduced) {
      prevValue.current = value;
      setDisplay(value);
      return;
    }
    if (!visible) return;
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, visible, reduced]);

  return <span ref={spanRef}>{display}</span>;
}

const statCards = [
  { key: 'resourceTotal', label: 'Hoeveelheid inzendingen' },
  { key: 'userVoteTotal', label: 'Gebruikers die hebben gestemd' },
  { key: 'resourceVotesCountTotal', label: 'Hoeveelheid stemmen' },
  { key: 'resourceVotesCountForTotal', label: 'Hoeveelheid stemmen voor' },
  {
    key: 'resourceVotesCountAgainstTotal',
    label: 'Hoeveelheid stemmen tegen',
  },
  { key: 'commentCountTotal', label: 'Hoeveelheid reacties' },
  { key: 'commentForCountTotal', label: 'Hoeveelheid reacties voor' },
  {
    key: 'commentAgainstCountTotal',
    label: 'Hoeveelheid reacties tegen',
  },
  {
    key: 'choicesguideresultsCountTotal',
    label: 'Hoeveelheid keuzewijzer inzendingen',
  },
  {
    key: 'enqueteSubmissionsCountTotal',
    label: 'Hoeveelheid enquête inzendingen',
  },
];

const charts = [
  {
    key: 'resourcesSubmittedPerDay',
    label: 'Hoeveelheid inzendingen per dag',
  },
  { key: 'votesPerDay', label: 'Hoeveelheid stemmen per dag' },
  {
    key: 'usersVotedPerDay',
    label: 'Hoeveelheid gebruikers die hebben gestemd per dag',
  },
  {
    key: 'enqueteSubmissionsPerDay',
    label: 'Hoeveelheid enquête inzendingen per dag',
  },
];

// The shared TabsTrigger has no underline; the design underlines the active sub-tab.
const subTabClass =
  'rounded-none data-[state=active]:underline data-[state=active]:underline-offset-4 data-[state=active]:decoration-2';

export default function Statistics() {
  const router = useRouter();
  const { project } = router.query;

  const [stats, setStats] = useState<StatsData>([]);
  const [initialLoad, setInitialLoad] = useState(true);

  const [fromDate, setFromDate] = useState<Date>(subMonths(new Date(), 1));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('cijfers');
  const [chartTab, setChartTab] = useState('inzendingen');

  useEffect(() => {
    if (!project) return;

    const controller = new AbortController();

    const params = new URLSearchParams();
    params.set('from', format(fromDate, 'yyyy-MM-dd'));
    params.set('to', format(toDate, 'yyyy-MM-dd'));

    fetch(`/api/openstad/stats/project/${project}/overview?${params}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      })
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching stats:', err);
        }
      })
      .finally(() => {
        setInitialLoad(false);
      });

    return () => controller.abort();
  }, [project, fromDate, toDate]);

  const formattedChartData = useMemo(() => {
    const result: Record<string, { date: string; counted: number }[]> = {};
    for (const chart of charts) {
      const timeSeries = getTimeSeries(stats, chart.key);
      result[chart.key] = timeSeries.map((point) => ({
        ...point,
        date: (() => {
          try {
            return format(parseISO(point.date), 'd MMM, yyyy', {
              locale: nl,
            });
          } catch {
            return point.date;
          }
        })(),
      }));
    }
    return result;
  }, [stats]);

  const filteredStatCards = useMemo(
    () => statCards.filter((card) => getStatByKey(stats, card.key)),
    [stats]
  );

  const filteredCharts = useMemo(
    () => charts.filter((chart) => formattedChartData[chart.key]?.length > 0),
    [formattedChartData]
  );

  return (
    <div>
      <PageLayout
        breadcrumbs={[
          {
            name: 'Projecten',
            url: '/projects',
          },
          {
            name: 'Statistieken',
            url: `/projects/${project}/statistics`,
          },
        ]}>
        <div className="px-4 py-4 sm:container sm:py-6">
          {initialLoad ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Laden...</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto flex-wrap gap-3 overflow-visible w-full bg-white border-b-0 mb-4 rounded-md justify-between p-4">
                <div className="flex shrink-0">
                  <TabsTrigger value="cijfers">Cijfers</TabsTrigger>
                  <TabsTrigger value="grafieken">Grafieken</TabsTrigger>
                </div>
                <DateRangeBar
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                />
              </TabsList>

              <TabsContent value="cijfers" className="p-0">
                <div className="p-4 sm:p-6 bg-white rounded-md">
                  {filteredStatCards.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {filteredStatCards.map((card) => (
                        <Card key={card.key}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              {card.label}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-3xl font-bold">
                              <AnimatedNumber
                                value={getCount(stats, card.key)}
                              />
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">
                      Er zijn nog geen statistieken beschikbaar voor dit project
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="grafieken" className="p-0">
                <Tabs value={chartTab} onValueChange={setChartTab}>
                  <TabsList className="w-full bg-white border-b-0 mb-4 rounded-md justify-start p-4">
                    <TabsTrigger value="inzendingen" className={subTabClass}>
                      Inzendingen
                    </TabsTrigger>
                    <TabsTrigger value="enquetes" className={subTabClass}>
                      Enquêtes
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="inzendingen" className="p-0">
                    <div className="p-4 sm:p-6 bg-white rounded-md">
                      {filteredCharts.length > 0 ? (
                        <div className="flex flex-col gap-6">
                          {filteredCharts.map((chart) => (
                            <div
                              key={chart.key}
                              className="p-6 bg-white rounded-md border">
                              <h3 className="text-lg font-semibold mb-4">
                                {chart.label}
                              </h3>
                              <SubmissionsAreaChart
                                data={formattedChartData[chart.key]}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-12">
                          Er zijn nog geen statistieken beschikbaar voor dit
                          project
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="enquetes" className="p-0">
                    <div className="w-full max-w-[1100px] bg-white rounded-md">
                      <EnqueteStatistics
                        project={project}
                        from={format(fromDate, 'yyyy-MM-dd')}
                        to={format(toDate, 'yyyy-MM-dd')}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </PageLayout>
    </div>
  );
}
