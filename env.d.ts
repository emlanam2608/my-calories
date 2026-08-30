declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    USDA_FDC_API_KEY?: string;
    HEALTH_DATA_ENCRYPTION_KEY?: string;
    HEALTH_DATA_ENCRYPTION_KEY_VERSION?: string;
  }
}
