import { SearchRepository } from '../database/repositories/SearchRepository.js';
import { SessionUser, GlobalSearchResult } from '../../shared/types.js';

export class SearchService {
  /**
   * Executes database-backed global search across all modules.
   * Safe for non-privileged operators (returns matching entities without sensitive credentials).
   */
  static async globalSearch(user: SessionUser, query: string): Promise<GlobalSearchResult> {
    if (!user || !user.id) {
      throw new Error('UNAUTHENTICATED: Active session required for global search.');
    }

    return SearchRepository.globalSearch(query, 6);
  }
}
