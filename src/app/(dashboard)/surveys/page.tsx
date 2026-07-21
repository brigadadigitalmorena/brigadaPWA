'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMyAssignments } from '@/lib/api/survey.service';
import { Assignment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Play, Calendar, Clock } from 'lucide-react';

export default function SurveysPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const data = await getMyAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load assignments:', err);
      setError('Error al cargar las encuestas asignadas');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando encuestas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadAssignments} variant="outline">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No tienes encuestas asignadas</CardTitle>
            <CardDescription>
              Cuando te asignen encuestas, aparecerán aquí
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Encuestas</h1>
        <p className="text-muted-foreground">
          Encuestas asignadas para completar
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {assignments.map((assignment) => (
          <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg line-clamp-2">
                  {assignment.survey_title}
                </CardTitle>
                <Badge variant={assignment.status === 'completed' ? 'default' : 'secondary'}>
                  {assignment.status === 'completed' ? 'Completada' : 'Pendiente'}
                </Badge>
              </div>
              <CardDescription className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Asignada: {new Date(assignment.created_at).toLocaleDateString()}
                  </span>
                </div>
                {assignment.due_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>
                      Vence: {new Date(assignment.due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/surveys/${assignment.survey_id}/fill`}>
                <Button className="w-full" disabled={assignment.status === 'completed'}>
                  <Play className="h-4 w-4 mr-2" />
                  {assignment.status === 'completed' ? 'Completada' : 'Iniciar encuesta'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
