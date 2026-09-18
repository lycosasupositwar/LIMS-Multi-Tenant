import fs from 'fs';
let code = fs.readFileSync('src/views/Samples.tsx', 'utf8');

const endBlock = `                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`;

const correctEndBlock = `                </div>
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`;

if (code.includes(endBlock)) {
  code = code.replace(endBlock, correctEndBlock);
  fs.writeFileSync('src/views/Samples.tsx', code);
  console.log("Fixed!");
} else {
  console.log("Could not find block");
}
