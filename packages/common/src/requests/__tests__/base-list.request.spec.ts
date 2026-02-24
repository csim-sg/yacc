import { BaseListRequest } from '../base-list.request';

describe('BaseListRequest', () => {
  describe('getOffset', () => {
    it('should return 0 for page 0 (first page)', () => {
      const req = new BaseListRequest();
      req.page = 0;
      req.limit = 15;
      expect(req.getOffset()).toBe(0);
    });

    it('should return 15 for page 1 (second page) with limit 15', () => {
      const req = new BaseListRequest();
      req.page = 1;
      req.limit = 15;
      expect(req.getOffset()).toBe(15);
    });

    it('should return 25 for page 1 with limit 25', () => {
      const req = new BaseListRequest();
      req.page = 1;
      req.limit = 25;
      expect(req.getOffset()).toBe(25);
    });

    it('should return 50 for page 2 (third page) with limit 25', () => {
      const req = new BaseListRequest();
      req.page = 2;
      req.limit = 25;
      expect(req.getOffset()).toBe(50);
    });

    it('should use default page (0) when page is undefined', () => {
      const req = new BaseListRequest();
      req.page = undefined;
      req.limit = 15;
      expect(req.getOffset()).toBe(0);
    });

    it('should use default limit (15) when limit is undefined', () => {
      const req = new BaseListRequest();
      req.page = 1;
      req.limit = undefined;
      expect(req.getOffset()).toBe(15);
    });

    it('should handle page 0 with default limit (15)', () => {
      const req = new BaseListRequest();
      req.page = 0;
      req.limit = undefined;
      expect(req.getOffset()).toBe(0);
      expect(req.getLimit()).toBe(15);
    });

    it('should calculate offset correctly for large page numbers', () => {
      const req = new BaseListRequest();
      req.page = 10;
      req.limit = 100;
      expect(req.getOffset()).toBe(1000); // 10 * 100 = 1000
    });
  });

  describe('getPage', () => {
    it('should return 0 for undefined page', () => {
      const req = new BaseListRequest();
      req.page = undefined;
      expect(req.getPage()).toBe(0);
    });

    it('should return 0 for negative page', () => {
      const req = new BaseListRequest();
      req.page = -1;
      expect(req.getPage()).toBe(0);
    });

    it('should return the page value for valid page', () => {
      const req = new BaseListRequest();
      req.page = 5;
      expect(req.getPage()).toBe(5);
    });
  });

  describe('getLimit', () => {
    it('should return default 15 for undefined limit', () => {
      const req = new BaseListRequest();
      req.limit = undefined;
      expect(req.getLimit()).toBe(15);
    });

    it('should return default 15 for invalid limit', () => {
      const req = new BaseListRequest();
      req.limit = 999;
      expect(req.getLimit()).toBe(15);
    });

    it('should return limit for valid limit in allowed values', () => {
      const req = new BaseListRequest();
      req.limit = 25;
      expect(req.getLimit()).toBe(25);
    });

    it('should return 100 for limit 100 (valid value)', () => {
      const req = new BaseListRequest();
      req.limit = 100;
      expect(req.getLimit()).toBe(100);
    });
  });

  describe('getSearch', () => {
    it('should return empty string for undefined searchText', () => {
      const req = new BaseListRequest();
      req.searchText = undefined;
      expect(req.getSearch()).toBe('');
    });

    it('should return the search text when provided', () => {
      const req = new BaseListRequest();
      req.searchText = 'test query';
      expect(req.getSearch()).toBe('test query');
    });
  });
});
