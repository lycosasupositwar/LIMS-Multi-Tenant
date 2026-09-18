import fs from 'fs';
let code = fs.readFileSync('src/views/Samples.tsx', 'utf8');

const regex = /              <\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)}\s*<\/div>\s*<\/div>\s*\);\s*}/g;
// Actually just replace the last part
const correctEnd = `                </div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`;

// split by '})()}'
const parts = code.split('})()}');
if (parts.length === 2) {
  let rest = parts[1];
  rest = `
                </div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`;
  fs.writeFileSync('src/views/Samples.tsx', parts[0] + '})()}' + rest);
  console.log('Fixed');
}
