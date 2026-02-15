export interface FoodSourceProvider {
  search(params: {
    query: string
    locale: 'de' | 'en'
  }): Promise<any>
}
