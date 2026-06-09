/**
 * useAnnotations — React Query hook for text-level (word-anchored) annotations.
 *
 * Fetches all annotations for the current book + chapter and returns:
 *   annotationsByVerse: Map<verse:number, AnnotationRecord[]>
 *   createAnnotation / updateAnnotation / deleteAnnotation — mutation helpers
 *   isLoading / isError
 *
 * Each AnnotationRecord has:
 *   { id, verse, word_start, word_end, anchor_text, content, color }
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

/**
 * Build a verse-keyed map from a flat annotation array.
 * @param {Array} annotations
 * @returns {Object} { [verse]: AnnotationRecord[] }
 */
function buildVerseMap(annotations) {
  const map = {}
  if (!annotations) return map
  for (const ann of annotations) {
    if (!map[ann.verse]) map[ann.verse] = []
    map[ann.verse].push(ann)
  }
  return map
}

export function useAnnotations(book, chapter) {
  const queryClient = useQueryClient()
  const queryKey = ['annotations', book, chapter]

  const enabled = !!book && !!chapter

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => api.getAnnotations(book, chapter),
    enabled,
    // Silently fail if user is not logged in — annotations are optional
    retry: false,
    onError: () => {},
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const createMutation = useMutation({
    mutationFn: (annData) => api.createAnnotation(annData),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...updates }) => api.updateAnnotation(id, updates),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteAnnotation(id),
    onSuccess: invalidate,
  })

  const annotationsByVerse = buildVerseMap(data)

  return {
    annotationsByVerse,
    isLoading,
    isError,
    createAnnotation: createMutation.mutateAsync,
    updateAnnotation: updateMutation.mutateAsync,
    deleteAnnotation: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
