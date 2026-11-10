import 'dotenv/config';
import { resetDemo } from '@/lib/demo/reset';

resetDemo({ force: true })
  .then(({ batch }) => console.log(`✓ Demo reset — batch ${batch}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
